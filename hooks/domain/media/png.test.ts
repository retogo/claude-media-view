import { describe, expect, test } from 'claude-code/testing'

import { decodeMedia } from './decode'
import { decodePng, encodePng, fitWithin } from './png'
import { zlibSync } from './vendor/fflate.js'

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
})

describe('fitWithin', () => {
  test('leaves an image that fits as it is', () => {
    const image = { width: 2, height: 1, rgba: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) }

    expect(fitWithin(image, 4)).toBe(image)
  })

  test('scales the long edge down to the limit by nearest pixel', () => {
    const rgba = new Uint8Array(4 * 2 * 4)
    rgba.set([9, 9, 9, 9], 0)
    rgba.set([7, 7, 7, 7], 8)

    expect(fitWithin({ width: 4, height: 2, rgba }, 2)).toEqual({ width: 2, height: 1, rgba: new Uint8Array([9, 9, 9, 9, 7, 7, 7, 7]) })
  })
})

describe('decodePng', () => {
  const pixels = (image: { rgba: Uint8Array }) => Array.from({ length: image.rgba.length / 4 }, (_, i) => Array.from(image.rgba.subarray(i * 4, i * 4 + 4)))

  test('decodes 8-bit RGB', () => {
    const image = decodePng(Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAGElEQVR4nGP4z8DAAMFcInInUoz+//8PADwZB5XvwsbYAAAAAElFTkSuQmCC'))

    expect([image.width, image.height]).toEqual([3, 2])
    expect(pixels(image)).toEqual([
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
      [10, 20, 30, 255],
      [200, 100, 50, 255],
      [255, 255, 255, 255],
    ])
  })

  test('decodes a palette', () => {
    const image = decodePng(Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAMAAAACBAMAAABvWnspAAAAElBMVEX///8A/wDIZDIKFB7/AAAAAP8STycHAAAADklEQVR4nGN05GcwYgAAAfEAhLB+fWEAAAAASUVORK5CYII='))

    expect(pixels(image)).toEqual([
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
      [10, 20, 30, 255],
      [200, 100, 50, 255],
      [255, 255, 255, 255],
    ])
  })

  test('decodes grey with alpha', () => {
    const image = decodePng(Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAQAAADYv8WvAAAAEklEQVR4nGNk+N/QyPCfweEEABPWBAk7r9lqAAAAAElFTkSuQmCC'))

    expect(pixels(image)).toEqual([
      [0, 0, 0, 255],
      [128, 128, 128, 128],
      [255, 255, 255, 0],
      [64, 64, 64, 200],
    ])
  })

  test('decodes 16-bit grey by its high bytes', () => {
    const image = decodePng(Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABEAAAAACB2fwVAAAADUlEQVR4nGNgYPj/HwADAgH/5ncLrgAAAABJRU5ErkJggg=='))

    expect(pixels(image)).toEqual([
      [0, 0, 0, 255],
      [255, 255, 255, 255],
    ])
  })

  test('undoes the scanline filters Pillow chose', () => {
    const image = decodePng(
      Uint8Array.fromBase64(
        'iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAIAAADRv8uKAAAAQUlEQVR4nO3VQQqAAAwDwREM4v8/7Ac862Uh90JoOwcu+z6ne/yQs8GqWsu1zkkPRC9zISEWF4tiUSwuFsWitw4eQSwZ9xxj0l0AAAAASUVORK5CYII=',
      ),
    )
    const expected = Array.from({ length: 30 * 40 }, (_, i) => {
      const x = i % 40
      const y = Math.floor(i / 40)
      return [(x * 7) % 256, (y * 9) % 256, ((x + y) * 5) % 256, 255]
    })

    expect(pixels(image)).toEqual(expected)
  })

  test('reads its own encoding back', () => {
    const rgba = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

    expect(decodePng(encodePng({ width: 3, height: 1, rgba }))).toEqual({ width: 3, height: 1, rgba })
  })
})

describe('decodePng limits', () => {
  test('refuses before inflating when the image has more pixels than allowed', () => {
    // 20000x20000 RGBA with an empty IDAT: only the header is real.
    const huge = encodePng({ width: 1, height: 1, rgba: new Uint8Array(4) })
    const ihdrSize = new DataView(huge.buffer, huge.byteOffset + 16, 8)
    ihdrSize.setUint32(0, 20000)
    ihdrSize.setUint32(4, 20000)

    expect(() => decodePng(huge, 24_000_000)).toThrow('20000×20000 PNG is over 24000000 pixels')
  })

  test('refuses a bit depth its colour type does not allow, before inflating', () => {
    // An RGB image may be 8 or 16 bits deep; 200 would make each row 75 times the bytes of 8.
    const deep = encodePng({ width: 1, height: 1, rgba: new Uint8Array(4) })
    const IHDR_BIT_DEPTH_AT = 24
    deep[IHDR_BIT_DEPTH_AT] = 200

    expect(() => decodePng(deep)).toThrow('unsupported PNG')
  })

  test('stops inflating once the data runs past what the header declares', () => {
    // A 1×1 RGB PNG whose IDAT inflates to 1 MB of zeros. CRCs are left zero: the decoder does not read them.
    const chunk = (type: string, body: Uint8Array) => {
      const bytes = new Uint8Array(12 + body.length)
      new DataView(bytes.buffer).setUint32(0, body.length)
      bytes.set([...type].map(char => char.charCodeAt(0)), 4)
      bytes.set(body, 8)
      return bytes
    }
    const header = new Uint8Array(13)
    new DataView(header.buffer).setUint32(0, 1)
    new DataView(header.buffer).setUint32(4, 1)
    header.set([8, 2], 8)
    const bomb = new Uint8Array([
      ...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      ...chunk('IHDR', header),
      ...chunk('IDAT', zlibSync(new Uint8Array(1_000_000))),
      ...chunk('IEND', new Uint8Array()),
    ])

    expect(() => decodePng(bomb)).toThrow('1×1 PNG inflates past its 4 bytes')
  })
})

describe('encodePng compression', () => {
  test('filters scanlines, so a smooth gradient compresses well and still reads back', () => {
    const width = 256
    const height = 256
    const rgba = new Uint8Array(width * height * 4)
    for (let i = 0; i < width * height; i++) {
      rgba.set([i % width, Math.floor(i / width), (i % width) ^ Math.floor(i / width), 255], i * 4)
    }
    const png = encodePng({ width, height, rgba })

    expect(decodePng(png).rgba).toEqual(rgba)
    expect(png.length).toBeLessThan(width * height)
  })
})
