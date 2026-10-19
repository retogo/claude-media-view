import { decodeMedia, decodeToRgba, mediaTypeOf, sniffImage, type RgbaFrame } from '../../domain/media/decode'
import { encodePng, fitWithin } from '../../domain/media/png'
import type { Ports } from '../ports'

const DEFAULT_MAX_FRAMES = 12
const MAX_FRAMES_LIMIT = 24
// Frames past this edge are scaled down before they are sent; the model would shrink them anyway.
const MAX_EDGE = 768
const MS_PER_SECOND = 1000
const SECONDS_DIGITS = 2
const FORMAT_NAMES: Record<string, string> = { 'image/png': 'PNG', 'image/gif': 'GIF', 'image/jpeg': 'JPEG' }
// A still within both is sent as it is: its base64 stays under the API's 5 MB per image, its edges under 8000 px.
const MAX_STILL_BYTES_AS_IS = 3.5 * 1024 * 1024
// 2000 px, not the 8000 a single image may have: once a request holds more than 20 images, every one is held to 2000.
const MAX_STILL_EDGE_AS_IS = 2000
// The base64 the API takes per image, and how much each retry shrinks a still that is still over it.
const MAX_IMAGE_BASE64_BYTES = 5_000_000
const SHRINK_STEP = 0.75
const BASE64_GROUP_BYTES = 3
const BASE64_GROUP_CHARACTERS = 4
// A larger still is decoded and scaled to the long edge the model reads at full detail.
const SCALED_STILL_EDGE = 1568

const DESCRIPTION = [
  'Shows you an image file, including every frame of an animated GIF: Read shows only a GIF’s first frame.',
  'Frames are sampled evenly (first and last always included), labelled with their time and delay, and returned as images.',
  'Use it to understand motion, timing or a sequence in a GIF, or to look at a PNG or JPEG.',
].join(' ')

const INPUT_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Absolute path, or relative to the working directory.' },
    maxFrames: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_FRAMES_LIMIT,
      description: `How many frames to send at most (default ${DEFAULT_MAX_FRAMES}).`,
    },
  },
  required: ['path'],
}

// What `$.tool.register` declares: the model calls it as `mcp__media-view__frames`.
export const FRAMES_TOOL = { name: 'frames', description: DESCRIPTION, inputSchema: INPUT_SCHEMA }

export type FramesInput = { path: string; maxFrames?: number }

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

const seconds = (ms: number) => `${(ms / MS_PER_SECOND).toFixed(SECONDS_DIGITS)} s`

const imageBlock = (mediaType: string, data: string): ContentBlock => ({ type: 'image', source: { type: 'base64', media_type: mediaType, data } })

// `frames` are already sampled and scaled; each says where it was in the source and how long until the next one sent.
const frameBlocks = (
  name: string,
  source: { width: number; height: number },
  scaled: { width: number; height: number },
  frames: RgbaFrame[],
  sourceFrameCount: number,
): ContentBlock[] => {
  const totalMs = frames.reduce((sum, frame) => sum + frame.delayMs, 0)
  const showing =
    frames.length === sourceFrameCount
      ? `Showing all ${sourceFrameCount} frames.`
      : `Showing ${frames.length} of ${sourceFrameCount} frames: ${frames.map(frame => frame.index + 1).join(', ')}.`
  return [
    { type: 'text', text: `${name}: GIF, ${sourceFrameCount} frames, ${source.width}×${source.height} px, ${seconds(totalMs)}. ${showing}` },
    ...frames.flatMap((frame): ContentBlock[] => [
      { type: 'text', text: `Frame ${frame.index + 1} of ${sourceFrameCount}, at ${seconds(frame.startMs)}, shown ${frame.delayMs} ms` },
      imageBlock('image/png', encodePng({ width: scaled.width, height: scaled.height, rgba: frame.rgba }).toBase64()),
    ]),
  ]
}

const stillBlocks = (name: string, bytes: Uint8Array, format: string, mediaType: string, width: number, height: number): ContentBlock[] | null => {
  const described = `${name}: ${format}, ${width}×${height} px, a still image.`
  if (bytes.length <= MAX_STILL_BYTES_AS_IS && Math.max(width, height) <= MAX_STILL_EDGE_AS_IS) {
    return [{ type: 'text', text: described }, imageBlock(mediaType, bytes.toBase64())]
  }
  const rgba = decodeToRgba(bytes)
  if (rgba === null) {
    return null
  }
  let edge = SCALED_STILL_EDGE
  let scaled = fitWithin(rgba, edge)
  let png = encodePng(scaled)
  while (Math.ceil(png.length / BASE64_GROUP_BYTES) * BASE64_GROUP_CHARACTERS > MAX_IMAGE_BASE64_BYTES) {
    edge = Math.floor(edge * SHRINK_STEP)
    scaled = fitWithin(rgba, edge)
    png = encodePng(scaled)
  }
  return [
    { type: 'text', text: `${described} Scaled to ${scaled.width}×${scaled.height} px.` },
    imageBlock('image/png', png.toBase64()),
  ]
}

// Claude Code checks no permission for a tool a hook answers: frames reads only what Read may (ADR 0011).
const readRefusal = async (ports: Pick<Ports, 'checkRead' | 'askRead'>, path: string) => {
  const verdict = await ports.checkRead(path)
  if (verdict.decision === 'deny') {
    return verdict.reason ?? `Read may not read ${path}`
  }
  return verdict.decision === 'ask' ? ports.askRead(path) : undefined
}

// The answer to a `frames` tool call: content blocks for the model, or a refusal (ADR 0010).
// The extension only screens out other files; the content decides the format.
export const frames = async (
  ports: Pick<Ports, 'readFile' | 'checkRead' | 'askRead'>,
  { path, maxFrames }: FramesInput,
): Promise<{ result: ContentBlock[] } | { deny: string }> => {
  const name = path.split(/[\\/]/).at(-1) ?? path
  const refusal = { deny: `${name} is not a PNG, GIF or JPEG image` }
  const named = mediaTypeOf(name)
  if (named === undefined || FORMAT_NAMES[named] === undefined) {
    return refusal
  }
  const readRefused = await readRefusal(ports, path)
  if (readRefused !== undefined) {
    return { deny: readRefused }
  }
  let bytes: Uint8Array
  try {
    bytes = await ports.readFile(path)
  } catch (error) {
    return { deny: `${name} could not be read: ${(error as Error).message}` }
  }
  const sniffed = sniffImage(bytes)
  if (sniffed === null) {
    return refusal
  }
  const format = FORMAT_NAMES[sniffed.mediaType]!
  try {
    const limit = Math.min(MAX_FRAMES_LIMIT, Math.max(1, Math.floor(maxFrames ?? DEFAULT_MAX_FRAMES)))
    const decoded = sniffed.mediaType === 'image/gif' ? decodeMedia(bytes, { maxEdge: MAX_EDGE, maxStillEdge: MAX_EDGE, maxFrames: limit }) : null
    if (decoded?.kind === 'rgba' && decoded.sourceFrameCount > 1) {
      return { result: frameBlocks(name, sniffed, decoded, decoded.frames, decoded.sourceFrameCount) }
    }
    const blocks = stillBlocks(name, bytes, format, sniffed.mediaType, sniffed.width, sniffed.height)
    return blocks === null ? refusal : { result: blocks }
  } catch (error) {
    return { deny: `${name} (${format}, ${sniffed.width}×${sniffed.height} px) could not be decoded: ${(error as Error).message}` }
  }
}
