import { unzlibSync } from './vendor/fflate.js'

// For tests, which check the PNGs the module writes without a PNG decoder of its own: the RGBA an 8-bit RGBA PNG
// of one IDAT chunk holds, its scanlines inflated and their filters undone by the specification's predictors.
export const readBack = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  const idatAt = png.findIndex((_, i) => String.fromCharCode(...png.subarray(i, i + 4)) === 'IDAT')
  const raw = unzlibSync(png.subarray(idatAt + 4, idatAt + 4 + view.getUint32(idatAt - 4)))
  const stride = width * 4
  const rgba = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? rgba[y * stride + x - 4]! : 0
      const up = y > 0 ? rgba[(y - 1) * stride + x]! : 0
      const upLeft = y > 0 && x >= 4 ? rgba[(y - 1) * stride + x - 4]! : 0
      const estimate = left + up - upLeft
      const [toLeft, toUp, toUpLeft] = [left, up, upLeft].map(value => Math.abs(estimate - value)) as [number, number, number]
      const paeth = toLeft <= toUp && toLeft <= toUpLeft ? left : toUp <= toUpLeft ? up : upLeft
      const predicted = [0, left, up, Math.floor((left + up) / 2), paeth][filter]!
      rgba[y * stride + x] = (raw[y * (stride + 1) + 1 + x]! + predicted) & 0xff
    }
  }
  return { width, height, rgba }
}
