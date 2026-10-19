import { imageFileName } from '../domain/imageTags'
import { decodeMedia, isCompleteImage, isDecodedName, MAX_CONVERTED_PIXELS, sniffConverted } from '../domain/media/decode'
import { cacheDirectoryName, framePlan, type Picture, type Plan } from '../domain/media/frameCache'
import { convertToPngCommand, joinPath, makeDirectoryCommand, writeBytesCommand } from '../domain/platform'
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
// A converted format's source and the PNG the OS makes of it, beside the picture's numbered frames.
const CONVERTED_SOURCE_FILE = 'source'
const CONVERTED_PNG_FILE = 'source.png'

// A source not there yet (a paste Claude Code is still writing): a failure to retry, not "no picture".
class NotWrittenYet extends Error {}

const pictures = new Map<string, Promise<Picture | null>>()
const plans = new Map<string, Plan>()
const failures = new Map<string, number>()
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

// A source in a converted format, as the PNG the OS makes of it in the picture's directory; null where the OS
// cannot convert it or reading the PNG back fails, which no retry changes, and for a source declaring more pixels
// than the decoders take, which is not handed to the OS at all (ADR 0029). Any other source is decoded as it is.
const convertedOrAsIs = async (ports: Ports, host: Host, directory: string, source: SourceImage | null) => {
  const converted = source && sniffConverted(source.bytes)
  if (!converted) {
    return source
  }
  const from = joinPath(host.os, directory, CONVERTED_SOURCE_FILE)
  const to = joinPath(host.os, directory, CONVERTED_PNG_FILE)
  const convert = convertToPngCommand(host.os, from, to)
  if (convert === null || converted.width * converted.height > MAX_CONVERTED_PIXELS) {
    return null
  }
  await ports.run(makeDirectoryCommand(host.os, directory))
  await ports.run(writeBytesCommand(host.os, from, source.bytes))
  try {
    await ports.run(convert)
    return { bytes: await ports.readFile(to) }
  } catch {
    return null
  }
}

// The picture's files, decoded once and kept until written. Undefined when the source is no picture or cannot be
// decoded, which no retry changes; a load that throws (I/O, a paste not written yet) is the caller's to retry.
const planFor = async (ports: Ports, host: Host, key: string, load: () => Promise<SourceImage | null>) => {
  const planned = plans.get(key)
  if (planned !== undefined) {
    return planned
  }
  const directory = joinPath(host.os, host.cacheRoot, await cacheDirectoryName(key))
  const decoded = decodeOrNull(await convertedOrAsIs(ports, host, directory, await load()))
  if (!decoded) {
    return undefined
  }
  const plan = framePlan(host.os, directory, decoded)
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
    const plan = await planFor(ports, host, key, load)
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

// The file a Read call read, kept from its `tool.call` for rows whose props do not carry it.
export const rememberReadPath = (toolUseId: string, path: string) => {
  readPaths.set(toolUseId, path)
}

export const readPathOf = (toolUseId: string) => readPaths.get(toolUseId)
