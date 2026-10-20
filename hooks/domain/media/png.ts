import { concat } from './bytes'
import type { Rgba } from './jpeg'
import { zlibSync } from './vendor/fflate.js'

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const BIT_DEPTH = 8
const COLOR_TYPE_RGBA = 6
const BYTES_PER_PIXEL = 4
const CRC_POLYNOMIAL = 0xedb88320
const BYTE_VALUES = 256
const COMPRESSION_LEVEL = 6
const SIGNED_BYTE_LIMIT = 128
const FILTER_NONE = 0
const FILTER_SUB = 1
const FILTER_UP = 2
const FILTER_AVERAGE = 3
const FILTER_PAETH = 4
const FILTERS = [FILTER_NONE, FILTER_SUB, FILTER_UP, FILTER_AVERAGE, FILTER_PAETH]

const paeth = (left: number, up: number, upLeft: number) => {
  const estimate = left + up - upLeft
  const toLeft = Math.abs(estimate - left)
  const toUp = Math.abs(estimate - up)
  const toUpLeft = Math.abs(estimate - upLeft)
  return toLeft <= toUp && toLeft <= toUpLeft ? left : toUp <= toUpLeft ? up : upLeft
}

// What a scanline filter predicts a byte from: the byte to its left, above it, and above-left.
const predict = (filter: number, left: number, up: number, upLeft: number) =>
  filter === FILTER_SUB
    ? left
    : filter === FILTER_UP
      ? up
      : filter === FILTER_AVERAGE
        ? Math.floor((left + up) / 2)
        : filter === FILTER_PAETH
          ? paeth(left, up, upLeft)
          : 0

const crcTable = Array.from({ length: BYTE_VALUES }, (_, n) => {
  let c = n
  for (let bit = 0; bit < BIT_DEPTH; bit++) {
    c = c & 1 ? CRC_POLYNOMIAL ^ (c >>> 1) : c >>> 1
  }
  return c >>> 0
})

const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff
  for (const byte of bytes) {
    c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

const uint32 = (value: number) => [value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]

const chunk = (type: string, data: Uint8Array) => {
  const body = concat([new TextEncoder().encode(type), data])
  return concat([new Uint8Array(uint32(data.length)), body, new Uint8Array(uint32(crc32(body)))])
}

// The filter whose output bytes, read as signed, sum smallest: the usual heuristic for compressing well.
const filterLine = (line: Uint8Array, above: Uint8Array | undefined, pixelBytes: number) => {
  let best = { filter: 0, bytes: line, cost: Number.POSITIVE_INFINITY }
  for (const filter of FILTERS) {
    const bytes = new Uint8Array(line.length)
    let cost = 0
    for (let x = 0; x < line.length; x++) {
      const left = x >= pixelBytes ? line[x - pixelBytes]! : 0
      const up = above?.[x] ?? 0
      const upLeft = above !== undefined && x >= pixelBytes ? above[x - pixelBytes]! : 0
      const value = (line[x]! - predict(filter, left, up, upLeft)) & 0xff
      bytes[x] = value
      cost += value < SIGNED_BYTE_LIMIT ? value : BYTE_VALUES - value
    }
    if (cost < best.cost) {
      best = { filter, bytes, cost }
    }
  }
  return best
}

export const encodePng = ({ width, height, rgba }: Rgba) => {
  const stride = width * BYTES_PER_PIXEL
  const scanlines = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const line = rgba.subarray(y * stride, (y + 1) * stride)
    const above = y > 0 ? rgba.subarray((y - 1) * stride, y * stride) : undefined
    const { filter, bytes } = filterLine(line, above, BYTES_PER_PIXEL)
    scanlines[y * (stride + 1)] = filter
    scanlines.set(bytes, y * (stride + 1) + 1)
  }
  const header = new Uint8Array([...uint32(width), ...uint32(height), BIT_DEPTH, COLOR_TYPE_RGBA, 0, 0, 0])
  return concat([
    new Uint8Array(SIGNATURE),
    chunk('IHDR', header),
    chunk('IDAT', zlibSync(scanlines, { level: COMPRESSION_LEVEL })),
    chunk('IEND', new Uint8Array()),
  ])
}

// The size an image scales to so its longer edge is at most `maxEdge`; unchanged when it already fits.
export const scaledSize = (width: number, height: number, maxEdge: number) => {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { scale, width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

// Along one axis, the source pixels each target pixel covers and how much of each: a source pixel split
// between two targets counts in both, by the share that falls in each. Flat typed arrays keep the loops tight.
const coverage = (sourceLength: number, targetLength: number) => {
  const span = sourceLength / targetLength
  const first = new Int32Array(targetLength)
  const count = new Int32Array(targetLength)
  const offset = new Int32Array(targetLength)
  const total = new Float64Array(targetLength)
  const weights: number[] = []
  for (let target = 0; target < targetLength; target++) {
    const start = target * span
    const end = Math.min(sourceLength, (target + 1) * span)
    first[target] = Math.floor(start)
    offset[target] = weights.length
    for (let index = first[target]!; index < end; index++) {
      const weight = Math.min(end, index + 1) - Math.max(start, index)
      weights.push(weight)
      total[target]! += weight
    }
    count[target] = weights.length - offset[target]!
  }
  return { first, count, offset, total, weights: Float64Array.from(weights) }
}

// Downscale so the longer edge is at most `maxEdge`, each pixel the average of the area it covers: text and lines
// stay legible where picking one source pixel per target would drop most of them. Colour is averaged by opacity
// (ADR 0019).
export const fitWithin = (image: Rgba, maxEdge: number): Rgba => {
  const { scale, width, height } = scaledSize(image.width, image.height, maxEdge)
  if (scale >= 1) {
    return image
  }
  const source = image.rgba
  const columns = coverage(image.width, width)
  const rows = coverage(image.height, height)
  // Across, then down; the colour channels hold colour × opacity until the end.
  const across = new Float64Array(width * image.height * BYTES_PER_PIXEL)
  for (let y = 0; y < image.height; y++) {
    const rowStart = y * image.width
    for (let x = 0; x < width; x++) {
      let red = 0
      let green = 0
      let blue = 0
      let opacity = 0
      for (let k = 0; k < columns.count[x]!; k++) {
        const from = (rowStart + columns.first[x]! + k) * BYTES_PER_PIXEL
        const weighted = source[from + 3]! * columns.weights[columns.offset[x]! + k]!
        red += source[from]! * weighted
        green += source[from + 1]! * weighted
        blue += source[from + 2]! * weighted
        opacity += weighted
      }
      const to = (y * width + x) * BYTES_PER_PIXEL
      across[to] = red
      across[to + 1] = green
      across[to + 2] = blue
      across[to + 3] = opacity
    }
  }
  const rgba = new Uint8Array(width * height * BYTES_PER_PIXEL)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let red = 0
      let green = 0
      let blue = 0
      let opacity = 0
      for (let k = 0; k < rows.count[y]!; k++) {
        const from = ((rows.first[y]! + k) * width + x) * BYTES_PER_PIXEL
        const weight = rows.weights[rows.offset[y]! + k]!
        red += across[from]! * weight
        green += across[from + 1]! * weight
        blue += across[from + 2]! * weight
        opacity += across[from + 3]! * weight
      }
      const to = (y * width + x) * BYTES_PER_PIXEL
      rgba[to] = opacity === 0 ? 0 : Math.round(red / opacity)
      rgba[to + 1] = opacity === 0 ? 0 : Math.round(green / opacity)
      rgba[to + 2] = opacity === 0 ? 0 : Math.round(blue / opacity)
      rgba[to + 3] = Math.round(opacity / (columns.total[x]! * rows.total[y]!))
    }
  }
  return { width, height, rgba }
}
