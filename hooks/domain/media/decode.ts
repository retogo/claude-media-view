import { decodeGif } from './gif'
import { decodeJpeg } from './jpeg'
import { fitWithin } from './png'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]
const GIF_SIGNATURE = [0x47, 0x49, 0x46, 0x38]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]
const PNG_WIDTH_OFFSET = 16
const PNG_HEIGHT_OFFSET = 20
const GIF_WIDTH_OFFSET = 6
const GIF_HEIGHT_OFFSET = 8
const JPEG_FIRST_MARKER = 2
const MARKER_PREFIX = 0xff
// Start-of-frame markers carry the size; 0xC4, 0xC8 and 0xCC share the range but do not.
const START_OF_FRAME_FIRST = 0xc0
const START_OF_FRAME_LAST = 0xcf
const NOT_START_OF_FRAME = [0xc4, 0xc8, 0xcc]
const SOF_HEIGHT_OFFSET = 5
const SOF_WIDTH_OFFSET = 7
const GIF_TRAILER = 0x3b
const JPEG_END = [0xff, 0xd9]
// A PNG ends with its IEND chunk: type, then a four-byte CRC.
const PNG_END = [0x49, 0x45, 0x4e, 0x44]
const PNG_CRC_BYTES = 4
// A WebP is a RIFF container whose form type, after the four-byte size, is WEBP.
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]
const WEBP_FORM = [0x57, 0x45, 0x42, 0x50]
const RIFF_FORM_OFFSET = 8
const FOURCC_BYTES = 4
// Its first chunk follows the RIFF header. A lossy `VP8 ` chunk's 14-bit width and height (the top two bits scale)
// follow a 3-byte frame tag and a 3-byte start code; a lossless `VP8L` packs width and height less one in 14 bits
// each after a signature byte; an extended `VP8X` keeps its canvas less one in 24 bits each after 4 flag bytes.
const WEBP_CHUNK_OFFSET = 12
const VP8_SIZE_OFFSET = 26
const VP8_SIZE_MASK = 0x3fff
const VP8L_SIZE_OFFSET = 21
const VP8L_SIZE_BITS = 14
const VP8L_SIZE_MASK = 0x3fff
const VP8X_WIDTH_OFFSET = 24
const VP8X_HEIGHT_OFFSET = 27
// An animated WebP sets the animation bit of its `VP8X` flags and holds a chunk per frame; every chunk is a name, a
// little-endian size and its data, padded to an even length.
const VP8X_FLAGS_OFFSET = 20
const VP8X_ANIMATION_FLAG = 0x02
const RIFF_CHUNK_HEADER_BYTES = 8
// A HEIC opens with an ISO media `ftyp` box, after the box's four-byte size, naming a HEIF major brand. An `ispe`
// box declares an image's size as two 32-bit numbers after its version and flags.
const FTYP = [0x66, 0x74, 0x79, 0x70]
const FTYP_OFFSET = 4
const MAJOR_BRAND_OFFSET = 8
const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']
const ISPE = [0x69, 0x73, 0x70, 0x65]
const ISPE_WIDTH_OFFSET = 8
const ISPE_HEIGHT_OFFSET = 12
// A TIFF opens with its byte order, Intel or Motorola, 42 in that order, and where its first IFD is. Each IFD entry
// is a tag, a type, a count and a value.
const TIFF_INTEL_SIGNATURE = [0x49, 0x49, 0x2a, 0x00]
const TIFF_MOTOROLA_SIGNATURE = [0x4d, 0x4d, 0x00, 0x2a]
const TIFF_IFD_OFFSET = 4
const TIFF_ENTRY_BYTES = 12
const TIFF_SHORT = 3
const TIFF_LONG = 4
const TIFF_IMAGE_WIDTH = 256
const TIFF_IMAGE_LENGTH = 257
// An SVG is text whose first element is `<svg`; it has no pixels of its own, so it is drawn at the size it declares,
// no larger than a still is kept (ADR 0031). An attribute counts only after white space, so `stroke-width` is not
// `width`.
const PROLOG_ENDS = [
  { start: '<?', end: '?>' },
  { start: '<!--', end: '-->' },
]
const SVG_ROOT = /^<svg[\s/>]/
const SVG_ATTRIBUTE = /\s(width|height|viewBox)\s*=\s*(["'])(.*?)\2/g
const PIXEL_LENGTH = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(?:px)?\s*$/
const VIEW_BOX_SEPARATOR = /[\s,]+/
const SVG_MAX_EDGE = 1024
const BYTE_ORDER_MARK = /^\uFEFF/
// What is not drawn, whatever the renderer does with it (ADR 0031): a document type, where entities that expand as
// the SVG is read are declared, and every way an SVG can refer outside itself. A reference may name a part of the
// SVG (`#id`) or carry a PNG, JPEG or GIF inline; anything else counts as outside. The patterns read the SVG as a
// parser and CSS would, past character references and escapes.
const INSIDE_REFERENCE = String.raw`(?:#|data:image\/(?:png|jpe?g|gif)[;,])`
// An element may carry any namespace prefix, as `svg:foreignObject`, in any characters a name may hold.
const ELEMENT_PREFIX = String.raw`(?:[^\s<>/:="']+:)?`
const UNSAFE_SVG = [
  /<!DOCTYPE/i,
  new RegExp(String.raw`\bhref\s*=(?!\s*["']\s*${INSIDE_REFERENCE})`, 'i'),
  new RegExp(String.raw`\burl\s*\((?!\s*["']?\s*${INSIDE_REFERENCE})`, 'i'),
  /@import/i,
  new RegExp(String.raw`<${ELEMENT_PREFIX}foreignObject\b`, 'i'),
  new RegExp(String.raw`<${ELEMENT_PREFIX}include\b`, 'i'),
]
// A parser ends every line with a line feed and turns a character reference (`&#117;`, `&#x75;`) or a predefined
// entity (`&quot;`) into its character, and CSS then turns an escape (`\75 `, `\u`) into its own: either could spell
// a reference the patterns would miss in the raw text. A CSS escape means nothing in a link, where `\23 a` is a
// relative URL and not `#a`, so the patterns read the SVG both as the parser leaves it and as CSS then reads it, and
// either reading's reference outside refuses it. A code point past Unicode's, or none, is read as the replacement
// character, as CSS reads it.
const LINE_END = /\r\n?/g
// CSS ends lines again, after the parser: a carriage return or form feed a character reference wrote is a line feed.
const CSS_LINE_END = /\r\n?|\f/g
const LINE_FEED = '\n'
const CHARACTER_REFERENCE = /&#(?:x([0-9a-f]+)|([0-9]+));/gi
const PREDEFINED_ENTITY = /&(lt|gt|amp|quot|apos);/g
const PREDEFINED_CHARACTERS: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }
const CSS_ESCAPE = /\\(?:([0-9a-f]{1,6})[ \t\n]?|([^\n0-9a-f]))/gi
const HEX = 16
const MAX_CODE_POINT = 0x10ffff
const REPLACEMENT_CHARACTER = '\uFFFD'
// The module reads an SVG as UTF-8, so one a parser would read in another encoding could hold what this reading
// does not see. An XML declaration is read only as the specification writes it, first in the file and declaring
// UTF-8 if any encoding; any other `<?xml`, a style sheet's processing instruction among them, is not drawn.
const XML_DECLARATION = /^<\?xml\s+version\s*=\s*(["'])1\.\d+\1(?:\s+encoding\s*=\s*(["'])utf-8\2)?(?:\s+standalone\s*=\s*(["'])(?:yes|no)\3)?\s*\?>/i
const XML_PROCESSING_TARGET = /<\?xml/gi

// `index` and `startMs` place the frame in its source, which may have had more frames.
export type RgbaFrame = { rgba: Uint8Array; delayMs: number; index: number; startMs: number }

// Bounds for decoded pixels: the longest edge of a GIF's frames, of a JPEG still (one frame, so it can be larger),
// and how many frames to keep.
export type DecodeLimits = { maxEdge: number; maxStillEdge: number; maxFrames: number }

// A PNG is drawn as it is; everything else becomes RGBA frames (one for a still).
export type Decoded =
  | { kind: 'png'; width: number; height: number; png: Uint8Array }
  | { kind: 'rgba'; width: number; height: number; frames: RgbaFrame[]; sourceFrameCount: number }

export type Sniffed = { mediaType: 'image/png' | 'image/gif' | 'image/jpeg'; width: number; height: number }

const startsWith = (bytes: Uint8Array, signature: readonly number[]) => signature.every((byte, i) => bytes[i] === byte)

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

const jpegSize = (bytes: Uint8Array) => {
  for (let at = JPEG_FIRST_MARKER; at + SOF_WIDTH_OFFSET + 2 <= bytes.length; ) {
    if (bytes[at] !== MARKER_PREFIX) {
      return undefined
    }
    // Any number of 0xFF fill bytes may come before a marker.
    while (bytes[at + 1] === MARKER_PREFIX) {
      at++
    }
    const marker = bytes[at + 1]!
    if (marker >= START_OF_FRAME_FIRST && marker <= START_OF_FRAME_LAST && !NOT_START_OF_FRAME.includes(marker)) {
      return { height: view(bytes).getUint16(at + SOF_HEIGHT_OFFSET), width: view(bytes).getUint16(at + SOF_WIDTH_OFFSET) }
    }
    at += 2 + view(bytes).getUint16(at + 2)
  }
  return undefined
}

// The format and size of an image, from its first bytes and header alone.
export const sniffImage = (bytes: Uint8Array): Sniffed | null => {
  if (startsWith(bytes, PNG_SIGNATURE) && bytes.length > PNG_HEIGHT_OFFSET + 4) {
    return { mediaType: 'image/png', width: view(bytes).getUint32(PNG_WIDTH_OFFSET), height: view(bytes).getUint32(PNG_HEIGHT_OFFSET) }
  }
  if (startsWith(bytes, GIF_SIGNATURE) && bytes.length > GIF_HEIGHT_OFFSET + 2) {
    return { mediaType: 'image/gif', width: view(bytes).getUint16(GIF_WIDTH_OFFSET, true), height: view(bytes).getUint16(GIF_HEIGHT_OFFSET, true) }
  }
  const size = startsWith(bytes, JPEG_SIGNATURE) ? jpegSize(bytes) : undefined
  return size === undefined ? null : { mediaType: 'image/jpeg', ...size }
}

// The formats the OS converts to PNG before the module decodes them (ADRs 0029, 0031).
export type ConvertedFormat = 'webp' | 'heic' | 'tiff' | 'svg'

export type SniffedConverted = { format: ConvertedFormat; width: number; height: number; frames: number }

// The pixels a converted format may declare and still be handed to the OS, per frame and across its frames: the
// caps PNG, GIF and JPEG are held to.
export const MAX_CONVERTED_PIXELS = 24_000_000
export const MAX_CONVERTED_TOTAL_PIXELS = 20 * MAX_CONVERTED_PIXELS

type Size = { width: number; height: number }

const startsWithAt = (bytes: Uint8Array, offset: number, signature: readonly number[]) => startsWith(bytes.subarray(offset), signature)

const chunkName = (bytes: Uint8Array, offset: number) => new TextDecoder().decode(bytes.subarray(offset, offset + FOURCC_BYTES))

const uint24 = (bytes: Uint8Array, offset: number) => bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16)

// A WebP's canvas, from its first chunk: each encoding keeps it in its own way.
const webpSize = (bytes: Uint8Array): Size | undefined => {
  const chunk = chunkName(bytes, WEBP_CHUNK_OFFSET)
  if (chunk === 'VP8 ' && bytes.length >= VP8_SIZE_OFFSET + 4) {
    return { width: view(bytes).getUint16(VP8_SIZE_OFFSET, true) & VP8_SIZE_MASK, height: view(bytes).getUint16(VP8_SIZE_OFFSET + 2, true) & VP8_SIZE_MASK }
  }
  if (chunk === 'VP8L' && bytes.length >= VP8L_SIZE_OFFSET + 4) {
    const bits = view(bytes).getUint32(VP8L_SIZE_OFFSET, true)
    return { width: (bits & VP8L_SIZE_MASK) + 1, height: ((bits >>> VP8L_SIZE_BITS) & VP8L_SIZE_MASK) + 1 }
  }
  if (chunk === 'VP8X' && bytes.length >= VP8X_HEIGHT_OFFSET + 3) {
    return { width: uint24(bytes, VP8X_WIDTH_OFFSET) + 1, height: uint24(bytes, VP8X_HEIGHT_OFFSET) + 1 }
  }
  return undefined
}

// A HEIC's largest `ispe` box: the primary image, its grid's tiles and its thumbnails each declare a size.
const heicSize = (bytes: Uint8Array): Size | undefined => {
  let largest: Size | undefined
  for (let at = bytes.indexOf(ISPE[0]!); at !== -1 && at + ISPE_HEIGHT_OFFSET + 4 <= bytes.length; at = bytes.indexOf(ISPE[0]!, at + 1)) {
    if (startsWithAt(bytes, at, ISPE)) {
      const size = { width: view(bytes).getUint32(at + ISPE_WIDTH_OFFSET), height: view(bytes).getUint32(at + ISPE_HEIGHT_OFFSET) }
      largest = largest === undefined || size.width * size.height > largest.width * largest.height ? size : largest
    }
  }
  return largest
}

// A TIFF's first image, from the width and length entries of its first IFD.
const tiffSize = (bytes: Uint8Array, isLittleEndian: boolean): Size | undefined => {
  if (bytes.length < TIFF_IFD_OFFSET + 4) {
    return undefined
  }
  const tiff = view(bytes)
  const ifd = tiff.getUint32(TIFF_IFD_OFFSET, isLittleEndian)
  if (ifd + 2 > bytes.length) {
    return undefined
  }
  const values = new Map<number, number>()
  for (let entry = 0; entry < tiff.getUint16(ifd, isLittleEndian); entry++) {
    const at = ifd + 2 + entry * TIFF_ENTRY_BYTES
    if (at + TIFF_ENTRY_BYTES > bytes.length) {
      return undefined
    }
    const type = tiff.getUint16(at + 2, isLittleEndian)
    const value = type === TIFF_SHORT ? tiff.getUint16(at + 8, isLittleEndian) : type === TIFF_LONG ? tiff.getUint32(at + 8, isLittleEndian) : undefined
    if (value !== undefined) {
      values.set(tiff.getUint16(at, isLittleEndian), value)
    }
  }
  const width = values.get(TIFF_IMAGE_WIDTH)
  const height = values.get(TIFF_IMAGE_LENGTH)
  return width === undefined || height === undefined ? undefined : { width, height }
}

// A WebP's frames: one, or the `ANMF` chunks of one whose `VP8X` flags it animated.
const webpFrames = (bytes: Uint8Array) => {
  if (chunkName(bytes, WEBP_CHUNK_OFFSET) !== 'VP8X' || ((bytes[VP8X_FLAGS_OFFSET] ?? 0) & VP8X_ANIMATION_FLAG) === 0) {
    return 1
  }
  let frames = 0
  for (let at = WEBP_CHUNK_OFFSET; at + RIFF_CHUNK_HEADER_BYTES <= bytes.length; ) {
    frames += chunkName(bytes, at) === 'ANMF' ? 1 : 0
    const size = view(bytes).getUint32(at + FOURCC_BYTES, true)
    at += RIFF_CHUNK_HEADER_BYTES + size + (size % 2)
  }
  return frames
}

// The start tag of an SVG's root element, past an XML declaration, comments and white space; undefined when the
// first element is not `<svg`.
const svgRootTag = (text: string) => {
  let rest = text
  for (;;) {
    rest = rest.trimStart()
    const prolog = PROLOG_ENDS.find(({ start }) => rest.startsWith(start))
    if (prolog === undefined) {
      break
    }
    const end = rest.indexOf(prolog.end)
    if (end === -1) {
      return undefined
    }
    rest = rest.slice(end + prolog.end.length)
  }
  return SVG_ROOT.test(rest) ? rest.slice(0, rest.indexOf('>') + 1) : undefined
}

// A length in pixels, as a number with no unit or `px`; undefined for a relative or other unit.
const pixelLength = (value: string | undefined) => {
  const match = value?.match(PIXEL_LENGTH)
  return match ? Number(match[1]) : undefined
}

// An SVG's size: its root's width and height in pixels, else its viewBox's; scaled down to a still's edge.
const svgSize = (tag: string): Size | undefined => {
  const attributes = new Map([...tag.matchAll(SVG_ATTRIBUTE)].map(match => [match[1]!, match[3]!]))
  const viewBox = attributes.get('viewBox')?.trim().split(VIEW_BOX_SEPARATOR).map(Number)
  const declared = [pixelLength(attributes.get('width')), pixelLength(attributes.get('height'))]
  const [width, height] = declared.every(length => length !== undefined) ? declared : [viewBox?.[2], viewBox?.[3]]
  if (!(width! > 0 && height! > 0 && Number.isFinite(width! * height!))) {
    return undefined
  }
  const scale = Math.min(1, SVG_MAX_EDGE / Math.max(width!, height!))
  return { width: Math.max(1, Math.round(width! * scale)), height: Math.max(1, Math.round(height! * scale)) }
}

// Whether a parser would read the SVG as UTF-8, as the module does: no XML declaration, or one alone, first.
const isReadAsUtf8 = (text: string) => {
  const targets = text.match(XML_PROCESSING_TARGET)?.length ?? 0
  return targets === 0 || (targets === 1 && XML_DECLARATION.test(text))
}

const character = (codePoint: number) =>
  codePoint > 0 && codePoint <= MAX_CODE_POINT ? String.fromCodePoint(codePoint) : REPLACEMENT_CHARACTER

// The SVG as a parser leaves it: line ends, character references and predefined entities decoded.
const parsedSvg = (text: string) =>
  text
    .replace(LINE_END, LINE_FEED)
    .replace(CHARACTER_REFERENCE, (_, hex: string | undefined, decimal: string) => character(hex ? parseInt(hex, HEX) : Number(decimal)))
    .replace(PREDEFINED_ENTITY, (_, name: string) => PREDEFINED_CHARACTERS[name]!)

// The parsed SVG as CSS reads it: its line ends, then its escapes, decoded.
const styledSvg = (parsed: string) =>
  parsed
    .replace(CSS_LINE_END, LINE_FEED)
    .replace(CSS_ESCAPE, (_, hex: string | undefined, other: string) => (hex ? character(parseInt(hex, HEX)) : other))

// Whether either reading of the SVG declares a document type or refers outside itself.
const isUnsafeSvg = (text: string) => {
  const parsed = parsedSvg(text)
  return [parsed, styledSvg(parsed)].some(reading => UNSAFE_SVG.some(pattern => pattern.test(reading)))
}

// An SVG's size, unless a parser could read it in another encoding than UTF-8, or it declares a document type or
// refers outside itself.
const svgShape = (bytes: Uint8Array): Size | undefined | null => {
  const text = new TextDecoder().decode(bytes).replace(BYTE_ORDER_MARK, '')
  const tag = svgRootTag(text)
  if (tag === undefined) {
    return null
  }
  return isReadAsUtf8(text) && !isUnsafeSvg(text) ? svgSize(tag) : undefined
}

const formatAndShape = (bytes: Uint8Array): [ConvertedFormat, Size | undefined, number] | null => {
  if (startsWith(bytes, RIFF_SIGNATURE) && startsWithAt(bytes, RIFF_FORM_OFFSET, WEBP_FORM)) {
    return ['webp', webpSize(bytes), webpFrames(bytes)]
  }
  if (startsWithAt(bytes, FTYP_OFFSET, FTYP)) {
    return HEIF_BRANDS.includes(chunkName(bytes, MAJOR_BRAND_OFFSET)) ? ['heic', heicSize(bytes), 1] : null
  }
  if (startsWith(bytes, TIFF_INTEL_SIGNATURE) || startsWith(bytes, TIFF_MOTOROLA_SIGNATURE)) {
    return ['tiff', tiffSize(bytes, startsWith(bytes, TIFF_INTEL_SIGNATURE)), 1]
  }
  const svg = svgShape(bytes)
  return svg === null ? null : ['svg', svg, 1]
}

// The converted format of an image, the size its header declares and its frames, so that its cost is known before
// the OS decodes it (ADR 0012); null for any other file, and where no size or frame can be read.
export const sniffConverted = (bytes: Uint8Array): SniffedConverted | null => {
  const [format, size, frames] = formatAndShape(bytes) ?? []
  return format === undefined || size === undefined || !frames ? null : { format, ...size, frames }
}

const endsWith = (bytes: Uint8Array, ending: readonly number[], skip = 0) =>
  ending.every((byte, i) => bytes[bytes.length - skip - ending.length + i] === byte)

// Whether an image's last bytes are there: a paste read while Claude Code still writes it is not.
export const isCompleteImage = (bytes: Uint8Array) => {
  const sniffed = sniffImage(bytes)
  if (sniffed === null) {
    return false
  }
  if (sniffed.mediaType === 'image/png') {
    return endsWith(bytes, PNG_END, PNG_CRC_BYTES)
  }
  return sniffed.mediaType === 'image/gif' ? bytes[bytes.length - 1] === GIF_TRAILER : endsWith(bytes, JPEG_END)
}

// A truncated or empty image decodes to no pixels; it is no picture.
const isEmpty = (size: { width: number; height: number }) => size.width === 0 || size.height === 0

// Decodes by content, whatever the file was called, within `limits` when given.
export const decodeMedia = (bytes: Uint8Array, limits?: DecodeLimits): Decoded | null => {
  const sniffed = sniffImage(bytes)
  if (sniffed === null || isEmpty(sniffed)) {
    return null
  }
  if (sniffed.mediaType === 'image/png') {
    return { kind: 'png', width: sniffed.width, height: sniffed.height, png: bytes }
  }
  if (sniffed.mediaType === 'image/gif') {
    const gif = decodeGif(bytes, limits ?? {})
    return gif.frames.length === 0
      ? null
      : { kind: 'rgba', width: gif.width, height: gif.height, frames: gif.frames, sourceFrameCount: gif.sourceFrameCount }
  }
  const decoded = decodeJpeg(bytes)
  const jpeg = limits === undefined ? decoded : fitWithin(decoded, limits.maxStillEdge)
  return { kind: 'rgba', width: jpeg.width, height: jpeg.height, frames: [{ rgba: jpeg.rgba, delayMs: 0, index: 0, startMs: 0 }], sourceFrameCount: 1 }
}

const MEDIA_TYPES: Record<string, string> = {
  png: 'image/png',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  tif: 'image/tiff',
  tiff: 'image/tiff',
}

export const mediaTypeOf = (fileName: string): string | undefined =>
  MEDIA_TYPES[fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()]

const DECODED_MEDIA_TYPES: readonly string[] = ['image/png', 'image/gif', 'image/jpeg'] satisfies Sniffed['mediaType'][]

// Whether a file of this name is one this module decodes: PNG, GIF or JPEG.
export const isDecodedName = (fileName: string) => DECODED_MEDIA_TYPES.includes(mediaTypeOf(fileName) ?? '')
