import { expect, test } from 'claude-code/testing'

import { decodeGif } from './gif'

// 2x2, two frames (70 ms, 120 ms); the second frame carries a local palette.
const TWO_FRAMES =
  'R0lGODlhAgACAIEAAP///wD/AP8AAAAA/yH/C05FVFNDQVBFMi4wAwEAAAAh+QQEBwAAACwAAAAAAgACAAAIBwAFBBgAICAAIfkEBAwAAAAsAAAAAAIAAgCBAP8A/wAAAAD/AAAACAcABwQAICAgADs='

const pixels = (rgba: Uint8Array) =>
  Array.from({ length: rgba.length / 4 }, (_, i) => Array.from(rgba.subarray(i * 4, i * 4 + 4)))

test('decodes the size of the logical screen', () => {
  const gif = decodeGif(Uint8Array.fromBase64(TWO_FRAMES))

  expect(gif.width).toBe(2)
  expect(gif.height).toBe(2)
})

test('decodes every frame as RGBA with its delay', () => {
  const gif = decodeGif(Uint8Array.fromBase64(TWO_FRAMES))

  expect(gif.frames.map(frame => frame.delayMs)).toEqual([70, 120])
  expect(gif.frames.map(frame => pixels(frame.rgba))).toEqual([
    [
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
      [255, 255, 255, 255],
    ],
    [
      [0, 0, 0, 255],
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
    ],
  ])
})

// 2x2, two frames of 10 ms and 20 ms.
const FAST_FRAMES =
  'R0lGODlhAgACAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQEAQAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQEAgAAACwAAAAAAgACAIEAAP8AAAAAAAAAAAAIBgABCAQQEAA7'

test('treats delays of 10 ms or less as 100 ms, as browsers do', () => {
  expect(decodeGif(Uint8Array.fromBase64(FAST_FRAMES)).frames.map(frame => frame.delayMs)).toEqual([100, 20])
})

// 2x2, ten frames of 50 ms, from blue to red.
const TEN_FRAMES =
  'R0lGODlhAgACAIEAAAAA/wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQEBQAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIEZAOYAAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIEyAM0AAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIFLALQAAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIFkAJsAAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIF9AIIAAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIGWAGkAAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIGvAFAAAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIHIADcAAAAAAAAAAAAIBgABCAQQEAAh+QQEBQAAACwAAAAAAgACAIHhAB4AAAAAAAAAAAAIBgABCAQQEAA7'

test('keeps an even sample of frames, each shown until the next kept one', () => {
  const gif = decodeGif(Uint8Array.fromBase64(TEN_FRAMES), { maxFrames: 3 })

  expect(gif.sourceFrameCount).toBe(10)
  expect(gif.frames.map(({ index, startMs, delayMs }) => ({ index, startMs, delayMs }))).toEqual([
    { index: 0, startMs: 0, delayMs: 250 },
    { index: 5, startMs: 250, delayMs: 200 },
    { index: 9, startMs: 450, delayMs: 50 },
  ])
})

test('scales frames down to a longest edge while decoding', () => {
  const gif = decodeGif(Uint8Array.fromBase64(TWO_FRAMES), { maxEdge: 1 })

  expect([gif.width, gif.height]).toEqual([1, 1])
  expect(gif.frames.map(frame => frame.rgba.length)).toEqual([4, 4])
})

// The logical screen's width and height follow the 6-byte header; TWO_FRAMES' first image separator is at 52,
// and its frame's width and height follow the separator, left and top.
const LOGICAL_SCREEN_AT = 6
const FIRST_FRAME_SIZE_AT = 52 + 1 + 4

const withSize = (at: number, width: number, height: number) => {
  const bytes = Uint8Array.fromBase64(TWO_FRAMES)
  new DataView(bytes.buffer).setUint16(at, width, true)
  new DataView(bytes.buffer).setUint16(at + 2, height, true)
  return bytes
}

test('refuses a logical screen with more pixels than allowed, before decoding', () => {
  expect(() => decodeGif(withSize(LOGICAL_SCREEN_AT, 20000, 20000), { maxPixels: 24_000_000 })).toThrow(
    '20000×20000 GIF is over 24000000 pixels',
  )
})

test('refuses a frame with more pixels than allowed, whatever the logical screen', () => {
  expect(() => decodeGif(withSize(FIRST_FRAME_SIZE_AT, 20000, 20000), { maxPixels: 24_000_000 })).toThrow(
    '20000×20000 GIF frame is over 24000000 pixels',
  )
})

// TWO_FRAMES' first graphic control extension starts at 44; its flags follow the introducer, label and size.
const FIRST_CONTROL_FLAGS_AT = 44 + 3
const DISPOSE_TO_PREVIOUS_FLAGS = 3 << 2

test('refuses a GIF whose decoding work is more than allowed, before decoding any frame', () => {
  // Two 2×2 frames, each kept as a copy of the 2×2 screen: 8 + 8 pixels.
  expect(() => decodeGif(Uint8Array.fromBase64(TWO_FRAMES), { maxTotalPixels: 15 })).toThrow('2 GIF frames take 16 pixels of work, over 15')
})

test('counts the copy of the screen a frame that restores the previous one takes', () => {
  const restoring = Uint8Array.fromBase64(TWO_FRAMES)
  restoring[FIRST_CONTROL_FLAGS_AT] = DISPOSE_TO_PREVIOUS_FLAGS

  // One frame kept: 8 pixels of frames and 4 for the kept copy, and 4 more for the first frame's copy of the screen.
  expect(() => decodeGif(Uint8Array.fromBase64(TWO_FRAMES), { maxFrames: 1, maxTotalPixels: 15 })).not.toThrow()
  expect(() => decodeGif(restoring, { maxFrames: 1, maxTotalPixels: 15 })).toThrow('2 GIF frames take 16 pixels of work, over 15')
})
