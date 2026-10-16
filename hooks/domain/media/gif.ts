import { concat } from './bytes'
import { fitWithin, scaledSize } from './png'
import { sampleIndices } from './sample'

// A kept frame: its pixels, where it was in the source, when it starts, and how long until the next kept frame.
export type GifFrame = { rgba: Uint8Array; delayMs: number; index: number; startMs: number }
export type Gif = { width: number; height: number; frames: GifFrame[]; sourceFrameCount: number }
// `maxEdge` scales frames down as they are decoded; `maxFrames` keeps an even sample of them; a screen or a frame
// with more than `maxPixels` is refused before anything is allocated for it, and a GIF whose decoding would touch
// more than `maxTotalPixels` (its frames, and every copy of the screen) before any frame is decoded.
export type GifOptions = { maxEdge?: number; maxFrames?: number; maxPixels?: number; maxTotalPixels?: number }

const HEADER_BYTES = 6
// The logical screen's background colour index and pixel aspect ratio, unused here.
const BACKGROUND_AND_ASPECT_BYTES = 2
const IMAGE_DESCRIPTOR_BYTES = 9
// The graphic control extension's fields: flags, delay (two bytes, little-endian), transparent colour index.
const CONTROL_FLAGS = 0
const CONTROL_DELAY = 1
const CONTROL_TRANSPARENT_INDEX = 3

const EXTENSION_INTRODUCER = 0x21
const IMAGE_SEPARATOR = 0x2c
const GRAPHIC_CONTROL_LABEL = 0xf9
const HAS_COLOR_TABLE = 0x80
const IS_INTERLACED = 0x40
const COLOR_TABLE_SIZE_BITS = 0x07
const HAS_TRANSPARENCY = 0x01
const DISPOSAL_SHIFT = 2
const DISPOSAL_BITS = 0x07
const DISPOSE_TO_BACKGROUND = 2
const DISPOSE_TO_PREVIOUS = 3
const CENTISECONDS_TO_MS = 10
const DEFAULT_DELAY_MS = 100
// Browsers draw delays this short or shorter at the default instead.
const SHORTEST_HONOURED_DELAY_MS = 10
const MAX_CODE_SIZE = 12
const MAX_CODES = 1 << MAX_CODE_SIZE
const BYTES_PER_PIXEL = 4
const OPAQUE = 255
// About 96 MB of RGBA, as for a PNG.
const DEFAULT_MAX_GIF_PIXELS = 24_000_000
// Decoding work across all frames: twenty full-size frames, or 480 frames of 1000×1000.
const DEFAULT_MAX_GIF_TOTAL_PIXELS = 20 * DEFAULT_MAX_GIF_PIXELS
// A frame's width and height in its image descriptor, after its left and top.
const DESCRIPTOR_WIDTH = 4
const DESCRIPTOR_HEIGHT = 6
const INTERLACE_PASSES = [
  { start: 0, step: 8 },
  { start: 4, step: 8 },
  { start: 2, step: 4 },
  { start: 1, step: 2 },
]

const at = (array: ArrayLike<number>, index: number) => array[index] ?? 0

const decodeLzw = (data: Uint8Array, minCodeSize: number, pixelCount: number) => {
  const out = new Uint8Array(pixelCount)
  const clearCode = 1 << minCodeSize
  const endCode = clearCode + 1
  const prefix = new Int32Array(MAX_CODES)
  const suffix = new Uint8Array(MAX_CODES)
  const first = new Uint8Array(MAX_CODES)
  const length = new Int32Array(MAX_CODES)
  for (let code = 0; code < clearCode; code++) {
    prefix[code] = -1
    suffix[code] = code
    first[code] = code
    length[code] = 1
  }

  let codeSize = minCodeSize + 1
  let nextCode = endCode + 1
  let previous = -1
  let written = 0
  let bits = 0
  let buffer = 0
  let position = 0

  while (written < pixelCount) {
    while (bits < codeSize) {
      if (position >= data.length) {
        return out
      }
      buffer |= at(data, position++) << bits
      bits += 8
    }
    const code = buffer & ((1 << codeSize) - 1)
    buffer >>>= codeSize
    bits -= codeSize

    if (code === clearCode) {
      codeSize = minCodeSize + 1
      nextCode = endCode + 1
      previous = -1
      continue
    }
    if (code === endCode) {
      break
    }
    if (previous !== -1 && nextCode < MAX_CODES) {
      prefix[nextCode] = previous
      suffix[nextCode] = code < nextCode ? at(first, code) : at(first, previous)
      first[nextCode] = at(first, previous)
      length[nextCode] = at(length, previous) + 1
      nextCode++
      if (nextCode === 1 << codeSize && codeSize < MAX_CODE_SIZE) {
        codeSize++
      }
    }

    let walk = code
    for (let offset = at(length, code) - 1; offset >= 0; offset--) {
      if (written + offset < pixelCount) {
        out[written + offset] = at(suffix, walk)
      }
      walk = at(prefix, walk)
    }
    written += at(length, code)
    previous = code
  }

  return out
}

const interlacedRows = (height: number) =>
  INTERLACE_PASSES.flatMap(({ start, step }) =>
    Array.from({ length: Math.max(0, Math.ceil((height - start) / step)) }, (_, i) => start + i * step),
  )

type Control = { delayMs: number; transparentIndex: number; disposal: number }

const reader = (bytes: Uint8Array) => {
  let position = HEADER_BYTES
  const byte = () => at(bytes, position++)
  return {
    isAtEnd: () => position >= bytes.length,
    byte,
    word: () => byte() | (byte() << 8),
    take: (size: number) => {
      const taken = bytes.subarray(position, position + size)
      position += size
      return taken
    },
    subBlocks: () => {
      const chunks: Uint8Array[] = []
      for (let size = byte(); size > 0; size = byte()) {
        chunks.push(bytes.subarray(position, position + size))
        position += size
      }
      return concat(chunks)
    },
  }
}

type Reader = ReturnType<typeof reader>

const colorTableSize = (flags: number) => 3 * (2 << (flags & COLOR_TABLE_SIZE_BITS))

// Walks the blocks after the logical screen, handing each image, positioned at its descriptor, to `onImage`,
// which reads it whole.
const walk = (read: Reader, onImage: (control: Control) => void) => {
  let control: Control = { delayMs: DEFAULT_DELAY_MS, transparentIndex: -1, disposal: 0 }
  while (!read.isAtEnd()) {
    const introducer = read.byte()
    if (introducer === EXTENSION_INTRODUCER) {
      const label = read.byte()
      const body = read.subBlocks()
      if (label === GRAPHIC_CONTROL_LABEL) {
        const flags = at(body, CONTROL_FLAGS)
        const declaredMs = (at(body, CONTROL_DELAY) | (at(body, CONTROL_DELAY + 1) << 8)) * CENTISECONDS_TO_MS
        control = {
          delayMs: declaredMs <= SHORTEST_HONOURED_DELAY_MS ? DEFAULT_DELAY_MS : declaredMs,
          transparentIndex: flags & HAS_TRANSPARENCY ? at(body, CONTROL_TRANSPARENT_INDEX) : -1,
          disposal: (flags >> DISPOSAL_SHIFT) & DISPOSAL_BITS,
        }
      }
      continue
    }
    if (introducer !== IMAGE_SEPARATOR) {
      return
    }
    onImage(control)
    control = { delayMs: DEFAULT_DELAY_MS, transparentIndex: -1, disposal: 0 }
  }
}

const readLogicalScreen = (read: Reader) => {
  const width = read.word()
  const height = read.word()
  const flags = read.byte()
  read.take(BACKGROUND_AND_ASPECT_BYTES)
  const globalTable = flags & HAS_COLOR_TABLE ? read.take(colorTableSize(flags)) : new Uint8Array()
  return { width, height, globalTable }
}

const word = (bytes: Uint8Array, index: number) => at(bytes, index) | (at(bytes, index + 1) << 8)

// Counts images, and the pixels their decoding touches short of the copies of kept frames, without decompressing
// them: each frame's own, and the screen a frame that restores the previous one copies first.
const countFrames = (bytes: Uint8Array) => {
  const read = reader(bytes)
  const screen = readLogicalScreen(read)
  let count = 0
  let pixels = 0
  walk(read, ({ disposal }) => {
    const descriptor = read.take(IMAGE_DESCRIPTOR_BYTES)
    const flags = at(descriptor, IMAGE_DESCRIPTOR_BYTES - 1)
    read.take(flags & HAS_COLOR_TABLE ? colorTableSize(flags) : 0)
    read.byte()
    read.subBlocks()
    count++
    pixels += word(descriptor, DESCRIPTOR_WIDTH) * word(descriptor, DESCRIPTOR_HEIGHT)
    if (disposal === DISPOSE_TO_PREVIOUS) {
      pixels += screen.width * screen.height
    }
  })
  return { count, pixels }
}

export const decodeGif = (
  bytes: Uint8Array,
  { maxEdge, maxFrames, maxPixels = DEFAULT_MAX_GIF_PIXELS, maxTotalPixels = DEFAULT_MAX_GIF_TOTAL_PIXELS }: GifOptions = {},
): Gif => {
  const { count: sourceFrameCount, pixels } = countFrames(bytes)
  const kept = new Set(sampleIndices(sourceFrameCount, maxFrames ?? sourceFrameCount))
  const read = reader(bytes)
  const { width, height, globalTable } = readLogicalScreen(read)
  if (width * height > maxPixels) {
    throw new Error(`${width}×${height} GIF is over ${maxPixels} pixels`)
  }
  // Every kept frame is a copy of the screen.
  const work = pixels + kept.size * width * height
  if (work > maxTotalPixels) {
    throw new Error(`${sourceFrameCount} GIF frames take ${work} pixels of work, over ${maxTotalPixels}`)
  }
  const size = maxEdge === undefined ? { width, height } : scaledSize(width, height, maxEdge)
  // fitWithin builds a new buffer when it scales; only an unscaled frame needs a copy of the canvas.
  const keep = () => (size.width === width && size.height === height ? canvas.slice() : fitWithin({ width, height, rgba: canvas }, maxEdge!).rgba)
  const canvas = new Uint8Array(width * height * BYTES_PER_PIXEL)
  const frames: GifFrame[] = []
  let index = 0
  let elapsedMs = 0

  walk(read, ({ delayMs, transparentIndex, disposal }) => {
    const left = read.word()
    const top = read.word()
    const frameWidth = read.word()
    const frameHeight = read.word()
    const frameFlags = read.byte()
    if (frameWidth * frameHeight > maxPixels) {
      throw new Error(`${frameWidth}×${frameHeight} GIF frame is over ${maxPixels} pixels`)
    }
    const table = frameFlags & HAS_COLOR_TABLE ? read.take(colorTableSize(frameFlags)) : globalTable
    const minCodeSize = read.byte()
    const indices = decodeLzw(read.subBlocks(), minCodeSize, frameWidth * frameHeight)
    const rows = frameFlags & IS_INTERLACED ? interlacedRows(frameHeight) : Array.from({ length: frameHeight }, (_, row) => row)
    const previous = disposal === DISPOSE_TO_PREVIOUS ? canvas.slice() : null

    rows.forEach((row, sourceRow) => {
      const y = top + row
      if (y >= height) {
        return
      }
      for (let column = 0; column < frameWidth; column++) {
        const x = left + column
        const colorIndex = at(indices, sourceRow * frameWidth + column)
        if (x >= width || colorIndex === transparentIndex) {
          continue
        }
        const target = (y * width + x) * BYTES_PER_PIXEL
        canvas[target] = at(table, colorIndex * 3)
        canvas[target + 1] = at(table, colorIndex * 3 + 1)
        canvas[target + 2] = at(table, colorIndex * 3 + 2)
        canvas[target + 3] = OPAQUE
      }
    })

    // A frame left out lengthens the kept one before it, so the whole still lasts as long.
    if (kept.has(index)) {
      frames.push({ rgba: keep(), delayMs, index, startMs: elapsedMs })
    } else if (frames.length > 0) {
      frames[frames.length - 1]!.delayMs += delayMs
    }
    index++
    elapsedMs += delayMs

    if (disposal === DISPOSE_TO_BACKGROUND) {
      for (let y = top; y < Math.min(height, top + frameHeight); y++) {
        const start = (y * width + left) * BYTES_PER_PIXEL
        canvas.fill(0, start, start + Math.min(frameWidth, width - left) * BYTES_PER_PIXEL)
      }
    } else if (previous) {
      canvas.set(previous)
    }
  })

  return { width: size.width, height: size.height, frames, sourceFrameCount }
}
