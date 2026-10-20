import { describe, expect, test } from 'claude-code/testing'

import { decodeMedia, decodeToRgba, isCompleteImage, sniffConverted, sniffImage } from './decode'

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

describe('sniffConverted', () => {
  // 3x2, saved by Pillow: lossy (VP8), lossless (VP8L), and lossy with alpha (VP8X), and as a little-endian TIFF.
  const WEBP_LOSSY = 'UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoDAAIAAsBMJaACdLoAA5gA/u2QP4hd7G2//PTP62/j/xkAAAA='
  const WEBP_LOSSLESS = 'UklGRh4AAABXRUJQVlA4TBEAAAAvAkAAEAdQjyLXo4CBiOh/AAA='
  const WEBP_EXTENDED =
    'UklGRlgAAABXRUJQVlA4WAoAAAAQAAAAAgAAAQAAQUxQSAcAAAAAgICAgICAAFZQOCAqAAAAkAEAnQEqAwACAALATCWgAnS6AAOYAP7tkD+IXextv/z0z+tv4/8ZAAAA'
  const TIFF_INTEL =
    'SUkqAAgAAAAKAAABBAABAAAAAwAAAAEBBAABAAAAAgAAAAIBAwADAAAAhgAAAAMBAwABAAAAAQAAAAYBAwABAAAAAgAAABEBBAABAAAAjAAAABUBAwABAAAAAwAAABYBBAABAAAAAgAAABcBBAABAAAAEgAAABwBAwABAAAAAQAAAAAAAAAIAAgACADIHh7IHh7IHh7IHh7IHh7IHh4='
  // 3x2, saved by sips: its `ispe` declares the 4x2 the HEVC frame is coded at.
  const HEIC =
    'AAAAGGZ0eXBoZWljAAAAAGhlaWNtaWYxAAABsG1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAHBpY3QAAAAAAAAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAADnBpdG0AAAAAAAEAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABodmMxAAAAARBpcHJwAAAA7mlwY28AAAATY29scm5jbHgAAgACAAaAAAAADGNsbGkAywBAAAAAFGlzcGUAAAAAAAAABAAAAAIAAAAoY2xhcAAAAAMAAAABAAAAAgAAAAH/wAAAAIAAAAAAAAAAAAABAAAACWlyb3QAAAAAEHBpeGkAAAAAAwgICAAAAHJodmNDAQNwAAAAsAAAAAAAHvAA/P34+AAACwOgAAEAF0ABDAH//wNwAAADALAAAAMAAAMAHnAkoQABACRCAQEDcAAAAwCwAAADAAADAB6gFCBBwJ8EGIe5FlU3AgIGAICiAAEACUQBwGFyyEBTJAAAABppcG1hAAAAAAAAAAEAAQeBAgMGh4SFAAAAHmlsb2MAAAAARAAAAQABAAAAAQAAAdgAAABbAAAAAW1kYXQAAAAAAAAAawAAAFcoAa+jXxpf6RgnQGtAboCiKoQqf/zfZVH8//1jYULxOvmY57JQnX/2me6j10Ff98Q1WRwh0D0hodRf147LphHermM5/Bfwe6uSqCkax/kP+sSZfSPvXv4='
  const bytesOf = (...parts: (string | number[])[]) =>
    new Uint8Array(parts.flatMap(part => (typeof part === 'string' ? [...new TextEncoder().encode(part)] : part)))
  // A big-endian TIFF whose first IFD gives its width as a SHORT and its height as a LONG.
  const TIFF_MOTOROLA = bytesOf('MM', [0, 0x2a], [0, 0, 0, 8], [0, 2], [1, 0, 0, 3, 0, 0, 0, 1, 0, 3, 0, 0], [1, 1, 0, 4, 0, 0, 0, 1, 0, 0, 0, 2], [0, 0, 0, 0])

  test('tells WebP, HEIC and TIFF apart by their first bytes, with the size their header declares', () => {
    expect(sniffConverted(Uint8Array.fromBase64(WEBP_LOSSY))).toEqual({ format: 'webp', width: 3, height: 2, frames: 1 })
    expect(sniffConverted(Uint8Array.fromBase64(WEBP_LOSSLESS))).toEqual({ format: 'webp', width: 3, height: 2, frames: 1 })
    expect(sniffConverted(Uint8Array.fromBase64(WEBP_EXTENDED))).toEqual({ format: 'webp', width: 3, height: 2, frames: 1 })
    expect(sniffConverted(Uint8Array.fromBase64(HEIC))).toEqual({ format: 'heic', width: 4, height: 2, frames: 1 })
    expect(sniffConverted(Uint8Array.fromBase64(TIFF_INTEL))).toEqual({ format: 'tiff', width: 3, height: 2, frames: 1 })
    expect(sniffConverted(TIFF_MOTOROLA)).toEqual({ format: 'tiff', width: 3, height: 2, frames: 1 })
  })

  test('counts the frames of an animated WebP', () => {
    // 64x64, three frames of 200 ms, saved by Pillow.
    const WEBP_ANIMATED =
      'UklGRmwBAABXRUJQVlA4WAoAAAACAAAAPwAAPwAAQU5JTQYAAAAAAAAAAABBTk1GagAAAAAAAAAAAD8AAD8AAMgAAAJWUDggUgAAALAEAJ0BKkAAQAA+bTaZSSQjIqEiCACADYlpBigAmQH4AAiBktlWJj2n15tXQAAA/vCbQ//+QXLC65Gv//yA/5Af8gP/5AflTZnMXkaKqgnwgABBTk1GZgAAAAAAAAAAAD8AAD8AAMgAAABWUDggTgAAADQEAJ0BKkAAQAA+bTKSSQIgAADYlpANWqgH4AfgACLt0ZQYR2nUfk1bsAD+5Yc//7WgODVf5n//+++FEduv9CX6YXsil/xM5+NS/wXAAEFOTUZgAAAAAAAAAAAAPwAAPwAAyAAAAFZQOCBIAAAA1AMAnQEqQABAAD5tMpJJAiAAANiWkGKACZAAfxrvCBpcJTqYto+AAP75Hdv//kB//kB//kB//ID//iF3shz8Hdpv277cgAAA'

    expect(sniffConverted(Uint8Array.fromBase64(WEBP_ANIMATED))).toEqual({ format: 'webp', width: 64, height: 64, frames: 3 })
  })

  test('takes the largest size a HEIC declares, as its tiles and thumbnails each declare their own', () => {
    const ispe = (width: number, height: number) => [...bytesOf([0, 0, 0, 0x14], 'ispe', [0, 0, 0, 0], [0, 0, width >> 8, width & 0xff], [0, 0, height >> 8, height & 0xff])]

    expect(sniffConverted(bytesOf([0, 0, 0, 0x18], 'ftypheic', [0, 0, 0, 0], ispe(320, 240), ispe(4032, 3024), ispe(512, 512)))).toEqual({
      format: 'heic',
      width: 4032,
      height: 3024,
      frames: 1,
    })
  })

  test('answers null for what the module decodes itself, for anything else, and where no size can be read', () => {
    expect(sniffConverted(Uint8Array.fromBase64(PNG_1X1))).toBeNull()
    expect(sniffConverted(bytesOf('RIFF', [0x24, 0, 0, 0], 'WAVEfmt '))).toBeNull()
    expect(sniffConverted(bytesOf([0, 0, 0, 0x18], 'ftypavif', [0, 0, 0, 0]))).toBeNull()
    expect(sniffConverted(bytesOf('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 '))).toBeNull()
    expect(sniffConverted(bytesOf([0, 0, 0, 0x18], 'ftypheic', [0, 0, 0, 0]))).toBeNull()
    expect(sniffConverted(bytesOf('II', [0x2a, 0], [0xff, 0xff, 0, 0]))).toBeNull()
  })
})

describe('sniffConverted of an SVG', () => {
  const svg = (text: string) => sniffConverted(new TextEncoder().encode(text))

  test('takes the size its root element declares, in pixels', () => {
    expect(svg('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100px"><rect/></svg>')).toEqual({ format: 'svg', width: 200, height: 100, frames: 1 })
  })

  test('takes the size of its viewBox where width and height are missing or relative', () => {
    expect(svg('<svg viewBox="0 0 24 12"/>')).toEqual({ format: 'svg', width: 24, height: 12, frames: 1 })
    expect(svg("<svg width='100%' height='100%' viewBox='-5 -5 40.5 20'/>")).toEqual({ format: 'svg', width: 41, height: 20, frames: 1 })
  })

  test('is drawn no larger than a still is kept, its shape kept', () => {
    expect(svg('<svg width="4096" height="2048"/>')).toEqual({ format: 'svg', width: 1024, height: 512, frames: 1 })
  })

  test('finds the root after a byte order mark, an XML declaration, comments and white space', () => {
    expect(svg('\uFEFF<?xml version="1.0"?>\n<!-- drawn by hand -->\n<svg width="8" height="8"/>')).toEqual({ format: 'svg', width: 8, height: 8, frames: 1 })
  })

  test('answers null for an SVG with a document type, which may declare entities, or with no size, and for other XML', () => {
    expect(svg('<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaa">]><svg width="8" height="8">&a;</svg>')).toBeNull()
    expect(svg('<svg width="8" height="8"><!DOCTYPE x></svg>')).toBeNull()
    expect(svg('<svg/>')).toBeNull()
    expect(svg('<svg width="0" height="8"/>')).toBeNull()
    expect(svg('<html><svg width="8" height="8"/></html>')).toBeNull()
  })

  test('answers null for an SVG declared in an encoding other than UTF-8, which could hide a document type from this reading', () => {
    expect(svg('<?xml version="1.0" encoding="UTF-7"?><svg width="8" height="8"/>')).toBeNull()
    expect(svg("<?xml version='1.0' encoding='ISO-8859-1'?><svg width=\"8\" height=\"8\"/>")).toBeNull()
    expect(svg('<?xml version="1.0" encoding="utf-8"?><svg width="8" height="8"/>')).toEqual({ format: 'svg', width: 8, height: 8, frames: 1 })
  })

  test('reads an XML declaration only as the specification writes it, first in the file, and answers null for any other', () => {
    expect(svg('<?xml version="1.0" standalone="no"?><svg width="8" height="8"/>')).toEqual({ format: 'svg', width: 8, height: 8, frames: 1 })
    expect(svg(' <?xml version="1.0" encoding="UTF-7"?><svg width="8" height="8"/>')).toBeNull()
    expect(svg('<!-- first --><?xml version="1.0" encoding="UTF-7"?><svg width="8" height="8"/>')).toBeNull()
    expect(svg('<?xml encoding="UTF-7" version="1.0"?><svg width="8" height="8"/>')).toBeNull()
    expect(svg('<?XML version="1.0" encoding="UTF-7"?><svg width="8" height="8"/>')).toBeNull()
  })

  test('answers null for an SVG that refers outside itself, and draws one whose references stay inside it', () => {
    const inside = (body: string) => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">${body}</svg>`)

    expect(inside('<image href="http://example.com/a.png"/>')).toBeNull()
    expect(inside('<image xlink:href="file:///etc/hosts"/>')).toBeNull()
    expect(inside('<use href="other.svg#a"/>')).toBeNull()
    expect(inside('<use href="&#35;a"/>')).toBeNull()
    expect(inside('<rect style="fill: url(http://example.com/p.svg#a)"/>')).toBeNull()
    expect(inside('<style>@import "a.css";</style>')).toBeNull()
    expect(inside('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml"/></foreignObject>')).toBeNull()
    expect(inside('<xi:include href="#a"/>')).toBeNull()
    expect(inside('<image href="data:image/svg+xml;base64,PHN2Zy8+"/>')).toBeNull()
    expect(inside('<svg:foreignObject><div xmlns="http://www.w3.org/1999/xhtml"/></svg:foreignObject>')).toBeNull()
    expect(inside('<x.y-z:include href="#a"/>')).toBeNull()
    expect(inside('<use href="#a"/><rect fill="url(#g)"/><rect fill="url( \'#g\' )"/><image href="data:image/png;base64,AAAA"/>')).toEqual({
      format: 'svg',
      width: 8,
      height: 8,
      frames: 1,
    })
  })

  test('answers null for an SVG escaping anything in an attribute or a style sheet, where an escape can hide a reference', () => {
    const inside = (body: string) => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">${body}</svg>`)

    expect(inside('<rect fill="&#117;rl(http://example.com/p.svg#a)"/>')).toBeNull()
    expect(inside("<rect style='fill: \\75 rl(http://example.com/p.svg#a)'/>")).toBeNull()
    expect(inside('<style>@\\69 mport "a.css";</style>')).toBeNull()
    expect(inside('<svg:style>rect { fill: u\\rl(http://example.com/p.svg#a) }')).toBeNull()
    expect(inside('<text x="0" y="8">C:\\out &#8211; done</text><style>rect { fill: url(#g) }</style>')).toEqual({ format: 'svg', width: 8, height: 8, frames: 1 })
  })

  test('reads a crafted SVG in time linear in its length', () => {
    const started = performance.now()

    expect(svg(`<svg${' width="'.repeat(200_000)}>`)).toBeNull()
    expect(svg(`<svg width="8" height="8">${'<style>a="b'.repeat(100_000)}`)).toEqual({ format: 'svg', width: 8, height: 8, frames: 1 })
    expect(svg(`<svg width="8" height="8">${"<x a='1\" b=\"2'".repeat(100_000)}`)).toEqual({ format: 'svg', width: 8, height: 8, frames: 1 })
    expect(performance.now() - started).toBeLessThan(500)
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
