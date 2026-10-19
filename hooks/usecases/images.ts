import { imageFileName } from '../domain/imageTags'
import { decodeMedia, isCompleteImage, isDecodedName } from '../domain/media/decode'
import { cacheDirectoryName, framePlan, type Picture, type Plan } from '../domain/media/frameCache'
import { joinPath, makeDirectoryCommand, writeBytesCommand } from '../domain/platform'
import type { SourceImage } from '../domain/readOutput'
import type { Host, Ports } from './ports'

const IMAGES_DIRECTORY = 'images'
const MAX_RETRIES = 3
// Long enough for Claude Code to finish writing a paste the draft already shows.
const RETRY_DELAY_MS = 250
// Pictures are drawn at most 40 columns wide, some 800 device pixels on a high-density screen: a still is kept up
// to that, while a GIF's many frames past a smaller edge, or past this count, only cost memory and disk (ADR 0006).
const DRAWN_LIMITS = { maxEdge: 512, maxStillEdge: 1024, maxFrames: 200 }
// Write processes running at once, across every picture (ADR 0007).
const CONCURRENT_WRITES = 4

// An image the transcript drew from a tool's result, with the session and row that drew it: `path` is the file a
// Read read, absent for an image a tool answered with; `label` names it, by its path or its tool; `callId` is the
// tool call that answered with it, when the row says.
export type SeenImage = {
  key: string
  path: string | undefined
  label: string
  callId: string | undefined
  picture: Promise<Picture | null>
  sessionId: string
  rowId: string
}

// A source not there yet (a paste Claude Code is still writing): a failure to retry, not "no picture".
class NotWrittenYet extends Error {}

const pictures = new Map<string, Promise<Picture | null>>()
const plans = new Map<string, Plan>()
const failures = new Map<string, number>()
const seen = new Map<string, SeenImage>()
const imageTagRows = new Map<string, string>()
const readPaths = new Map<string, string>()
const pasteCaches = new Map<string, string>()

let writesRunning = 0
const writesWaiting: (() => void)[] = []

const withWriteSlot = async (write: () => Promise<void>) => {
  if (writesRunning >= CONCURRENT_WRITES) {
    await new Promise<void>(resolve => writesWaiting.push(resolve))
  }
  writesRunning++
  try {
    await write()
  } finally {
    writesRunning--
    writesWaiting.shift()?.()
  }
}

const decodeOrNull = (source: SourceImage | null) => {
  try {
    return source && decodeMedia(source.bytes, DRAWN_LIMITS)
  } catch {
    return null
  }
}

// The picture's files, decoded once and kept until written. Undefined when the source is no picture or cannot be
// decoded, which no retry changes; a load that throws (I/O, a paste not written yet) is the caller's to retry.
const planFor = async (host: Host, key: string, load: () => Promise<SourceImage | null>) => {
  const planned = plans.get(key)
  if (planned !== undefined) {
    return planned
  }
  const decoded = decodeOrNull(await load())
  if (!decoded) {
    return undefined
  }
  const plan = framePlan(host.os, joinPath(host.os, host.cacheRoot, await cacheDirectoryName(key)), decoded)
  plans.set(key, plan)
  return plan
}

const writePlan = async (ports: Ports, host: Host, { directory, writes, ...picture }: Plan): Promise<Picture> => {
  await ports.run(makeDirectoryCommand(host.os, directory))
  await Promise.all(writes.map(({ path, bytes }) => withWriteSlot(() => ports.run(writeBytesCommand(host.os, path, bytes)))))
  return picture
}

// A failed load or write is forgotten and retried on a later draw, at most MAX_RETRIES times; a decoded plan is
// kept, so a retry only writes. After that the picture stays absent (ADR 0007).
const loadOrRetry = async (ports: Ports, key: string, load: () => Promise<SourceImage | null>): Promise<Picture | null> => {
  try {
    const host = await ports.host()
    const plan = await planFor(host, key, load)
    if (plan === undefined) {
      return null
    }
    const picture = await writePlan(ports, host, plan)
    plans.delete(key)
    return picture
  } catch {
    const failed = (failures.get(key) ?? 0) + 1
    failures.set(key, failed)
    if (failed <= MAX_RETRIES) {
      pictures.delete(key)
      ports.requestRedraw(RETRY_DELAY_MS)
    } else {
      plans.delete(key)
    }
    return null
  }
}

// Decodes and writes a source to the frame cache once per key; later calls share the result.
// Resolves null, never rejects, when the source is no picture or every attempt failed.
export const loadPicture = (ports: Ports, key: string, load: () => Promise<SourceImage | null>) => {
  if (!pictures.has(key)) {
    pictures.set(key, loadOrRetry(ports, key, load))
  }
  return pictures.get(key)!
}

// The paste cache folder of a session, `<tmp root>/<project>/<session>/images`, remembered once found.
export const pasteCacheOf = async (ports: Ports, host: Host, sessionId: string) => {
  const known = pasteCaches.get(sessionId)
  if (known !== undefined) {
    return known
  }
  for (const project of await ports.listDirectory(host.tmpRoot)) {
    const images = joinPath(host.os, host.tmpRoot, project.name, sessionId, IMAGES_DIRECTORY)
    if (project.kind === 'dir' && (await ports.exists(images))) {
      pasteCaches.set(sessionId, images)
      return images
    }
  }
  return undefined
}

const readImageTag = async (ports: Ports, sessionId: string, n: number): Promise<SourceImage | null> => {
  const host = await ports.host()
  const images = await pasteCacheOf(ports, host, sessionId)
  const name = images === undefined ? undefined : imageFileName((await ports.listDirectory(images)).map(entry => entry.name), n)
  if (images === undefined || name === undefined) {
    throw new NotWrittenYet(`[Image #${n}] is not in the paste cache yet`)
  }
  if (!isDecodedName(name)) {
    return null
  }
  const bytes = await ports.readFile(joinPath(host.os, images, name))
  if (!isCompleteImage(bytes)) {
    throw new NotWrittenYet(`[Image #${n}] is still being written`)
  }
  return { bytes }
}

// The picture of `[Image #n]`, from the session's paste cache (ADR 0004).
export const loadImageTag = (ports: Ports, sessionId: string, n: number) =>
  loadPicture(ports, `paste/${sessionId}/${n}`, () => readImageTag(ports, sessionId, n))

export const rememberSeen = (image: SeenImage) => {
  seen.set(image.key, image)
}

// The images the transcript drew from tools' results in a session, oldest first.
export const seenImages = (sessionId: string) => [...seen.values()].filter(image => image.sessionId === sessionId)

export const rememberImageTagRow = (sessionId: string, n: number, rowId: string) => {
  imageTagRows.set(`${sessionId}/${n}`, rowId)
}

// The transcript row that drew `[Image #n]`, if one has.
export const imageTagRowOf = (sessionId: string, n: number) => imageTagRows.get(`${sessionId}/${n}`)

// The file a Read call read, kept from its `tool.call` for rows whose props do not carry it.
export const rememberReadPath = (toolUseId: string, path: string) => {
  readPaths.set(toolUseId, path)
}

export const readPathOf = (toolUseId: string) => readPaths.get(toolUseId)
