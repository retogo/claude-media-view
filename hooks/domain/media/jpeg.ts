import { decode } from './vendor/jpeg-js-decoder.js'

export type Rgba = { width: number; height: number; rgba: Uint8Array }

// jpeg-js throws past either. A 12-megapixel phone photo needs about 230 MB by jpeg-js's count.
const MAX_MEGAPIXELS = 24
const MAX_MEMORY_MB = 512

export const decodeJpeg = (bytes: Uint8Array): Rgba => {
  const image = decode(bytes, { formatAsRGBA: true, maxResolutionInMP: MAX_MEGAPIXELS, maxMemoryUsageInMB: MAX_MEMORY_MB })
  return { width: image.width, height: image.height, rgba: image.data }
}
