import { describe, expect, test } from 'claude-code/testing'

import { convertedFormatOf, decodeMedia, decodeToRgba, isCompleteImage, sniffImage } from './decode'

// 1x1 transparent PNG.
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

// 2x2, two frames (70 ms, 120 ms).
const GIF_TWO_FRAMES =
  'R0lGODlhAgACAIEAAP///wD/AP8AAAAA/yH/C05FVFNDQVBFMi4wAwEAAAAh+QQEBwAAACwAAAAAAgACAAAIBwAFBBgAICAAIfkEBAwAAAAsAAAAAAIAAgCBAP8A/wAAAAD/AAAACAcABwQAICAgADs='

// 16x8 baseline JPEG.
const JPEG_16X8 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAAIABADAREAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD4vr+Uz/fw+Q6/6qD/AJrz/9k='

describe('sniffImage', () => {
  test('tells PNG, GIF and JPEG apart by their first bytes, with their size from the header', () => {
    expect(sniffImage(Uint8Array.fromBase64(PNG_1X1))).toEqual({ mediaType: 'image/png', width: 1, height: 1 })
    expect(sniffImage(Uint8Array.fromBase64(GIF_TWO_FRAMES))).toEqual({ mediaType: 'image/gif', width: 2, height: 2 })
    expect(sniffImage(Uint8Array.fromBase64(JPEG_16X8))).toEqual({ mediaType: 'image/jpeg', width: 16, height: 8 })
  })

  test('answers null for anything else', () => {
    expect(sniffImage(new TextEncoder().encode('RIFF....WEBPVP8 '))).toBeNull()
  })
})

describe('convertedFormatOf', () => {
  const bytesOf = (...parts: (string | number[])[]) =>
    new Uint8Array(parts.flatMap(part => (typeof part === 'string' ? [...new TextEncoder().encode(part)] : part)))

  test('tells WebP, HEIC and TIFF apart by their first bytes', () => {
    expect(convertedFormatOf(bytesOf('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 '))).toBe('webp')
    expect(convertedFormatOf(bytesOf([0, 0, 0, 0x18], 'ftypheic', [0, 0, 0, 0]))).toBe('heic')
    expect(convertedFormatOf(bytesOf([0, 0, 0, 0x18], 'ftypmif1', [0, 0, 0, 0]))).toBe('heic')
    expect(convertedFormatOf(bytesOf('II', [0x2a, 0], [8, 0, 0, 0]))).toBe('tiff')
    expect(convertedFormatOf(bytesOf('MM', [0, 0x2a], [0, 0, 0, 8]))).toBe('tiff')
  })

  test('answers null for what the module decodes itself, and for anything else', () => {
    expect(convertedFormatOf(Uint8Array.fromBase64(PNG_1X1))).toBeNull()
    expect(convertedFormatOf(bytesOf('RIFF', [0x24, 0, 0, 0], 'WAVEfmt '))).toBeNull()
    expect(convertedFormatOf(bytesOf([0, 0, 0, 0x18], 'ftypavif', [0, 0, 0, 0]))).toBeNull()
  })
})

describe('decodeMedia', () => {
  test('keeps a PNG as it is, with its size from the header', () => {
    const bytes = Uint8Array.fromBase64(PNG_1X1)

    expect(decodeMedia(bytes)).toEqual({ kind: 'png', width: 1, height: 1, png: bytes })
  })

  test('decodes a GIF to RGBA frames with delays', () => {
    const decoded = decodeMedia(Uint8Array.fromBase64(GIF_TWO_FRAMES))

    expect(decoded?.kind).toBe('rgba')
    expect(decoded?.kind === 'rgba' && decoded.frames.map(frame => frame.delayMs)).toEqual([70, 120])
  })

  test('decodes a JPEG by its content, whatever it was called', () => {
    expect(decodeMedia(Uint8Array.fromBase64(JPEG_16X8))).toMatchObject({ kind: 'rgba', width: 16, height: 8 })
  })

  test('scales a JPEG still to the still edge, a GIF to the frame edge', () => {
    const limits = { maxEdge: 1, maxStillEdge: 8, maxFrames: 2 }

    expect(decodeMedia(Uint8Array.fromBase64(JPEG_16X8), limits)).toMatchObject({ width: 8, height: 4 })
    expect(decodeMedia(Uint8Array.fromBase64(GIF_TWO_FRAMES), limits)).toMatchObject({ width: 1, height: 1 })
  })

  test('answers null for a format it does not decode', () => {
    expect(decodeMedia(new Uint8Array([1, 2, 3]))).toBeNull()
  })

  test('answers null for a GIF with no frames', () => {
    // Header, a 2x2 logical screen with no colour table, then the trailer.
    const noFrames = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 2, 0, 2, 0, 0, 0, 0, 0x3b])

    expect(decodeMedia(noFrames)).toBeNull()
  })
})

describe('sniffImage on JPEG fill bytes', () => {
  test('skips the 0xFF fill bytes JPEG allows before a marker', () => {
    expect(sniffImage(Uint8Array.fromBase64('/9j/4AAQSkZJRgABAQAAAQABAAD////bAEMAAgEBAQEBAgEBAQICAgICBAMCAgICBQQEAwQGBQYGBgUGBgYHCQgGBwkHBgYICwgJCgoKCgoGCAsMCwoMCQoKCv/bAEMBAgICAgICBQMDBQoHBgcKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCv/AABEIAAgAEAMBEQACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/APi+v5TP9/D5Dr/qoP8AmvP/2Q=='))).toEqual({ mediaType: 'image/jpeg', width: 16, height: 8 })
  })
})

describe('isCompleteImage', () => {
  test('tells a whole file from one cut short while it is written', () => {
    const png = Uint8Array.fromBase64(PNG_1X1)
    const gif = Uint8Array.fromBase64(GIF_TWO_FRAMES)
    const jpeg = Uint8Array.fromBase64(JPEG_16X8)

    expect([png, gif, jpeg].map(isCompleteImage)).toEqual([true, true, true])
    expect([png, gif, jpeg].map(bytes => isCompleteImage(bytes.subarray(0, bytes.length - 3)))).toEqual([false, false, false])
  })
})

describe('decodeToRgba', () => {
  test('keeps only a GIF’s first frame, so many frames on a large screen stay within the work allowed', () => {
    // A 4000×4000 screen with 31 one-pixel frames: keeping every frame would copy the screen 31 times.
    const SIDE = 4000
    const FRAMES = 31
    const word = (value: number) => [value & 0xff, value >> 8]
    const frame = [0x2c, ...word(0), ...word(0), ...word(1), ...word(1), 0, 2, 2, 0x4c, 0x01, 0]
    const gif = new Uint8Array([
      ...new TextEncoder().encode('GIF89a'),
      ...word(SIDE),
      ...word(SIDE),
      0x80,
      0,
      0,
      ...[0, 0, 0, 255, 255, 255],
      ...Array.from({ length: FRAMES }, () => frame).flat(),
      0x3b,
    ])

    expect(decodeToRgba(gif)?.width).toBe(SIDE)
  })
})
