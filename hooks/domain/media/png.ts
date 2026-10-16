import { concat } from './bytes'
import type { Rgba } from './jpeg'
import { Unzlib, zlibSync } from './vendor/fflate.js'

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

// Nearest-pixel downscale so the longer edge is at most `maxEdge`.
export const fitWithin = (image: Rgba, maxEdge: number): Rgba => {
  const { scale, width, height } = scaledSize(image.width, image.height, maxEdge)
  if (scale >= 1) {
    return image
  }
  const rgba = new Uint8Array(width * height * BYTES_PER_PIXEL)
  for (let y = 0; y < height; y++) {
    const sourceY = Math.min(image.height - 1, Math.floor(y / scale))
    for (let x = 0; x < width; x++) {
      const sourceX = Math.min(image.width - 1, Math.floor(x / scale))
      const from = (sourceY * image.width + sourceX) * BYTES_PER_PIXEL
      rgba.set(image.rgba.subarray(from, from + BYTES_PER_PIXEL), (y * width + x) * BYTES_PER_PIXEL)
    }
  }
  return { width, height, rgba }
}

const CHUNK_TYPE_OFFSET = 4
const CHUNK_HEADER_BYTES = 8
const IHDR_WIDTH = 0
const IHDR_HEIGHT = 4
const IHDR_BIT_DEPTH = 8
const IHDR_COLOR_TYPE = 9
const IHDR_INTERLACE = 12
// About 96 MB of RGBA; past it a decode is refused before anything is inflated.
const DEFAULT_MAX_PNG_PIXELS = 24_000_000
const CHUNK_CRC_BYTES = 4
// Compressed bytes handed to the inflater at a time: what one push can inflate to stays bounded.
const INFLATE_INPUT_BYTES = 16 * 1024
const OPAQUE = 255
const SIXTEEN_BITS = 16
const COLOR_TYPE_GREY = 0
const COLOR_TYPE_RGB = 2
const COLOR_TYPE_PALETTE = 3
const COLOR_TYPE_GREY_ALPHA = 4
// Each colour type's channels and the bit depths the PNG specification allows it.
const COLOR_TYPES: Record<number, { channels: number; bitDepths: number[] }> = {
  [COLOR_TYPE_GREY]: { channels: 1, bitDepths: [1, 2, 4, 8, 16] },
  [COLOR_TYPE_RGB]: { channels: 3, bitDepths: [8, 16] },
  [COLOR_TYPE_PALETTE]: { channels: 1, bitDepths: [1, 2, 4, 8] },
  [COLOR_TYPE_GREY_ALPHA]: { channels: 2, bitDepths: [8, 16] },
  [COLOR_TYPE_RGBA]: { channels: 4, bitDepths: [8, 16] },
}
const readUint32 = (bytes: Uint8Array, at: number) => new DataView(bytes.buffer, bytes.byteOffset + at, 4).getUint32(0)

// Reverses each scanline's filter in place, given the bytes per pixel (at least 1).
const unfilter = (raw: Uint8Array, height: number, stride: number, pixelBytes: number) => {
  const lines = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const at = y * stride
    for (let x = 0; x < stride; x++) {
      const left = x >= pixelBytes ? lines[at + x - pixelBytes]! : 0
      const up = y > 0 ? lines[at - stride + x]! : 0
      const upLeft = y > 0 && x >= pixelBytes ? lines[at - stride + x - pixelBytes]! : 0
      lines[at + x] = (line[x]! + predict(filter, left, up, upLeft)) & 0xff
    }
  }
  return lines
}

// The scanlines `data` inflates to, into a buffer of the `size` the header declares; refused as soon as they run
// past it, so a small file cannot inflate to gigabytes. Data that ends short leaves the rest zero.
const inflateScanlines = (data: Uint8Array, size: number, describe: () => string) => {
  const scanlines = new Uint8Array(size)
  let written = 0
  const inflater = new Unzlib(chunk => {
    if (written + chunk.length > size) {
      throw new Error(`${describe()} inflates past its ${size} bytes`)
    }
    scanlines.set(chunk, written)
    written += chunk.length
  })
  // Empty data still gets its final push, which refuses it as the stream it is not.
  for (let at = 0, isFinal = false; !isFinal; at += INFLATE_INPUT_BYTES) {
    isFinal = at + INFLATE_INPUT_BYTES >= data.length
    inflater.push(data.subarray(at, at + INFLATE_INPUT_BYTES), isFinal)
  }
  return scanlines
}

// A non-interlaced PNG of any colour type, at a bit depth the specification allows it, to 8-bit RGBA (16-bit samples keep their high byte),
// refused when it has more than `maxPixels`.
export const decodePng = (png: Uint8Array, maxPixels = DEFAULT_MAX_PNG_PIXELS): Rgba => {
  if (!SIGNATURE.every((byte, i) => png[i] === byte)) {
    throw new Error('not a PNG')
  }
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let palette: Uint8Array = new Uint8Array()
  let transparency: Uint8Array = new Uint8Array()
  const data: Uint8Array[] = []
  for (let at = SIGNATURE.length; at + CHUNK_HEADER_BYTES <= png.length; ) {
    const length = readUint32(png, at)
    const type = String.fromCharCode(...png.subarray(at + CHUNK_TYPE_OFFSET, at + CHUNK_HEADER_BYTES))
    const body = png.subarray(at + CHUNK_HEADER_BYTES, at + CHUNK_HEADER_BYTES + length)
    if (type === 'IHDR') {
      width = readUint32(body, IHDR_WIDTH)
      height = readUint32(body, IHDR_HEIGHT)
      bitDepth = body[IHDR_BIT_DEPTH]!
      colorType = body[IHDR_COLOR_TYPE]!
      if (body[IHDR_INTERLACE] !== 0) {
        throw new Error('interlaced PNGs are not supported')
      }
      if (width * height > maxPixels) {
        throw new Error(`${width}×${height} PNG is over ${maxPixels} pixels`)
      }
    } else if (type === 'PLTE') {
      palette = body
    } else if (type === 'tRNS') {
      transparency = body
    } else if (type === 'IDAT') {
      data.push(body)
    } else if (type === 'IEND') {
      break
    }
    at += CHUNK_HEADER_BYTES + length + CHUNK_CRC_BYTES
  }
  const colorTypeSpec = COLOR_TYPES[colorType]
  if (colorTypeSpec === undefined || !colorTypeSpec.bitDepths.includes(bitDepth) || width === 0 || height === 0) {
    throw new Error('unsupported PNG')
  }
  const { channels } = colorTypeSpec
  const bitsPerPixel = channels * bitDepth
  const stride = Math.ceil((width * bitsPerPixel) / BIT_DEPTH)
  const scanlines = inflateScanlines(concat(data), (stride + 1) * height, () => `${width}×${height} PNG`)
  const lines = unfilter(scanlines, height, stride, Math.max(1, bitsPerPixel / BIT_DEPTH))
  const maxSample = (1 << Math.min(bitDepth, BIT_DEPTH)) - 1
  // A sample's raw value, and the same value scaled to 8 bits.
  const sample = (y: number, index: number) => {
    const at = y * stride
    if (bitDepth === SIXTEEN_BITS) {
      const raw = (lines[at + index * 2]! << 8) | lines[at + index * 2 + 1]!
      return { raw, value: raw >> 8 }
    }
    if (bitDepth === BIT_DEPTH) {
      return { raw: lines[at + index]!, value: lines[at + index]! }
    }
    const bit = index * bitDepth
    const raw = (lines[at + (bit >> 3)]! >> (BIT_DEPTH - bitDepth - (bit & 7))) & maxSample
    return { raw, value: Math.round((raw * OPAQUE) / maxSample) }
  }
  // The keyed (fully transparent) value of a grey or RGB channel: two bytes per channel in tRNS.
  const transparentAt = (channel: number) => (transparency[channel * 2]! << 8) | transparency[channel * 2 + 1]!
  const rgba = new Uint8Array(width * height * BYTES_PER_PIXEL)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const out = (y * width + x) * BYTES_PER_PIXEL
      const first = sample(y, x * channels)
      if (colorType === COLOR_TYPE_PALETTE) {
        rgba.set(palette.subarray(first.raw * 3, first.raw * 3 + 3), out)
        rgba[out + 3] = first.raw < transparency.length ? transparency[first.raw]! : OPAQUE
      } else if (colorType === COLOR_TYPE_GREY || colorType === COLOR_TYPE_GREY_ALPHA) {
        rgba.fill(first.value, out, out + 3)
        rgba[out + 3] =
          colorType === COLOR_TYPE_GREY_ALPHA
            ? sample(y, x * channels + 1).value
            : transparency.length >= 2 && first.raw === transparentAt(0)
              ? 0
              : OPAQUE
      } else {
        const green = sample(y, x * channels + 1)
        const blue = sample(y, x * channels + 2)
        rgba.set([first.value, green.value, blue.value], out)
        const isKeyed =
          colorType === COLOR_TYPE_RGB &&
          transparency.length >= 6 &&
          first.raw === transparentAt(0) &&
          green.raw === transparentAt(1) &&
          blue.raw === transparentAt(2)
        rgba[out + 3] = colorType === COLOR_TYPE_RGBA ? sample(y, x * channels + 3).value : isKeyed ? 0 : OPAQUE
      }
    }
  }
  return { width, height, rgba }
}
