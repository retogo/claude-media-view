import { describe, expect, test } from 'claude-code/testing'

import { decodeMedia } from './decode'
import { encodePng, fitWithin } from './png'
import { readBack } from './png.testing'

describe('encodePng', () => {
  test('writes a PNG whose header carries the size', () => {
    const png = encodePng({ width: 3, height: 2, rgba: new Uint8Array(3 * 2 * 4).fill(200) })

    expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(decodeMedia(png)).toMatchObject({ kind: 'png', width: 3, height: 2 })
  })

  test('compresses flat colour far below the raw size', () => {
    const width = 256
    const height = 256

    expect(encodePng({ width, height, rgba: new Uint8Array(width * height * 4).fill(255) }).length).toBeLessThan(width * height)
  })

  test('holds the pixels it was given', () => {
    const rgba = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

    expect(readBack(encodePng({ width: 3, height: 1, rgba }))).toEqual({ width: 3, height: 1, rgba })
  })

  test('filters scanlines, so a smooth gradient compresses well and still holds its pixels', () => {
    const width = 256
    const height = 256
    const rgba = new Uint8Array(width * height * 4)
    for (let i = 0; i < width * height; i++) {
      rgba.set([i % width, Math.floor(i / width), (i % width) ^ Math.floor(i / width), 255], i * 4)
    }
    const png = encodePng({ width, height, rgba })

    expect(readBack(png).rgba).toEqual(rgba)
    expect(png.length).toBeLessThan(width * height)
  })
})

describe('fitWithin', () => {
  test('leaves an image that fits as it is', () => {
    const image = { width: 2, height: 1, rgba: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) }

    expect(fitWithin(image, 4)).toBe(image)
  })

  // Opaque pixels of one grey level each.
  const greys = (width: number, height: number, levels: number[]) => ({
    width,
    height,
    rgba: new Uint8Array(levels.flatMap(level => [level, level, level, 255])),
  })

  test('scales the long edge down to the limit, each pixel the average of the area it covers', () => {
    // A black and white checkerboard of 4×2 becomes two mid-grey pixels, not two of its corners.
    const checkerboard = greys(4, 2, [0, 255, 0, 255, 255, 0, 255, 0])

    expect(fitWithin(checkerboard, 2)).toEqual(greys(2, 1, [128, 128]))
  })

  test('weighs a source pixel by how much of it falls in each target pixel', () => {
    // 3 → 2: the middle pixel is split in half between the two.
    expect(fitWithin(greys(3, 1, [0, 90, 180]), 2)).toEqual(greys(2, 1, [30, 150]))
  })

  test('averages colour by opacity, so transparent pixels add no dark edge', () => {
    const halfClear = { width: 2, height: 1, rgba: new Uint8Array([200, 100, 50, 255, 0, 0, 0, 0]) }

    expect(fitWithin(halfClear, 1)).toEqual({ width: 1, height: 1, rgba: new Uint8Array([200, 100, 50, 128]) })
  })
})
