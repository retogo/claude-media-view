import { MAX_CONVERTED_PIXELS, type ConvertedFormat } from './media/decode'

export type Os = 'mac' | 'linux' | 'windows'

// A process to run: its argument vector, and its stdin, extra environment and time limit.
export type Command = { argv: string[]; init: { stdin?: string; env?: Record<string, string>; timeoutMs?: number } }

const WINDOWS_OS_VARIABLE = 'Windows_NT'
const MAC_UNAME = 'Darwin'
const POSIX_TMP_BASE = '/tmp'
// Paths reach child processes through the environment, never through a shell string.
const PATH_VARIABLE = 'MEDIA_VIEW_PATH'
const POWERSHELL = ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command']

export const osFrom = ({ osVariable, uname }: { osVariable: string | undefined; uname: string | undefined }): Os => {
  if (osVariable === WINDOWS_OS_VARIABLE) {
    return 'windows'
  }
  return uname?.trim() === MAC_UNAME ? 'mac' : 'linux'
}

export const isWindows = (osVariable: string | undefined) => osVariable === WINDOWS_OS_VARIABLE

export const joinPath = (os: Os, ...parts: string[]) => parts.join(os === 'windows' ? '\\' : '/')

// Where Claude Code keeps per-session files, the paste cache among them.
export const tmpRootFor = (
  os: Os,
  { claudeTmpDir, temp, uid }: { claudeTmpDir: string | undefined; temp: string | undefined; uid: string | undefined },
) => {
  if (os === 'windows') {
    return `${temp}\\claude`
  }
  const base = (claudeTmpDir ?? POSIX_TMP_BASE).replace(/\/+$/, '')
  return `${base}/claude-${uid}`
}

// `$.fs.write` writes text only; binary goes through a process reading base64 on stdin.
export const writeBytesCommand = (os: Os, path: string, bytes: Uint8Array): Command => {
  const init = { stdin: bytes.toBase64(), env: { [PATH_VARIABLE]: path } }
  if (os === 'windows') {
    return {
      argv: [...POWERSHELL, `[IO.File]::WriteAllBytes($env:${PATH_VARIABLE}, [Convert]::FromBase64String([Console]::In.ReadToEnd()))`],
      init,
    }
  }
  return { argv: ['/bin/sh', '-c', `base64 -d > "$${PATH_VARIABLE}"`], init }
}

export const makeDirectoryCommand = (os: Os, path: string): Command =>
  os === 'windows'
    ? { argv: [...POWERSHELL, `New-Item -ItemType Directory -Force -Path $env:${PATH_VARIABLE} | Out-Null`], init: { env: { [PATH_VARIABLE]: path } } }
    : { argv: ['mkdir', '-p', path], init: {} }

export const openCommand = (os: Os, path: string): Command =>
  os === 'windows'
    ? { argv: [...POWERSHELL, `Start-Process -FilePath $env:${PATH_VARIABLE}`], init: { env: { [PATH_VARIABLE]: path } } }
    : os === 'mac'
      ? { argv: ['open', path], init: {} }
      : // xdg-open waits for some viewers to exit; in the background it returns at once.
        { argv: ['/bin/sh', '-c', `xdg-open "$${PATH_VARIABLE}" >/dev/null 2>&1 &`], init: { env: { [PATH_VARIABLE]: path } } }

const OUT_PATH_VARIABLE = 'MEDIA_VIEW_OUT_PATH'

// What turns a converted format into a PNG or a GIF: the OS's own codecs, or an ffmpeg the person installed (ADR 0030).
export type Converter = 'os' | 'ffmpeg'

// `width` and `height` are the sniffed size, at which an SVG is drawn.
export type Conversion = { from: string; to: string; format: ConvertedFormat; isAnimated: boolean; width: number; height: number }

// A conversion still running past this is given up on: a small SVG can still take long to draw (ADR 0031).
const CONVERSION_TIMEOUT_MS = 10_000

// AppKit draws an SVG into a bitmap of the size given, which it then writes as a PNG. An SVG's references to other
// files or URLs are not followed: AppKit draws a placeholder for each (ADR 0031).
const APPKIT_SVG_SCRIPT = `ObjC.import('AppKit')
function run([from, to, width, height]) {
  const image = $.NSImage.alloc.initWithContentsOfFile(from)
  if (image.isNil()) {
    throw new Error('AppKit read no SVG')
  }
  const bitmap = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel($(), Number(width), Number(height), 8, 4, true, false, $.NSDeviceRGBColorSpace, 0, 0)
  $.NSGraphicsContext.saveGraphicsState
  $.NSGraphicsContext.setCurrentContext($.NSGraphicsContext.graphicsContextWithBitmapImageRep(bitmap))
  image.drawInRectFromRectOperationFraction($.NSMakeRect(0, 0, Number(width), Number(height)), $.NSZeroRect, $.NSCompositingOperationCopy, 1)
  $.NSGraphicsContext.restoreGraphicsState
  if (!bitmap.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $()).writeToFileAtomically(to, true)) {
    throw new Error('AppKit wrote no PNG')
  }
}`

// ImageIO writes an animated WebP's frames as a looping GIF, each held as long as the WebP holds it. JXA knows no
// type for ImageIO's key constants, so the keys are written as the strings they stand for (ADR 0029).
const IMAGE_IO_GIF_SCRIPT = `ObjC.import('Foundation')
ObjC.import('ImageIO')
const gif = (key, value) => $.NSDictionary.dictionaryWithObjectForKey($.NSDictionary.dictionaryWithObjectForKey(value, key), '{GIF}')
function run([from, to]) {
  const source = $.CGImageSourceCreateWithURL($.NSURL.fileURLWithPath(from), $())
  const count = $.CGImageSourceGetCount(source)
  const destination = $.CGImageDestinationCreateWithURL($.NSURL.fileURLWithPath(to), $('com.compuserve.gif'), count, $())
  $.CGImageDestinationSetProperties(destination, gif('LoopCount', $(0)))
  for (let i = 0; i < count; i++) {
    const webp = ObjC.castRefToObject($.CGImageSourceCopyPropertiesAtIndex(source, i, $())).objectForKey('{WebP}')
    $.CGImageDestinationAddImageFromSource(destination, source, i, gif('DelayTime', webp.objectForKey('UnclampedDelayTime')))
  }
  if (!$.CGImageDestinationFinalize(destination)) {
    throw new Error('ImageIO wrote no GIF')
  }
}`
// One palette made for the whole animation keeps its colours closer than GIF's default palette.
const FFMPEG_GIF_FILTER = 'split[a][b];[a]palettegen[p];[b][p]paletteuse'
// ffmpeg reads only the local file, as the demuxer of the format the module sniffed rather than whatever its own
// probe finds, and decodes no frame past the module's pixel cap (ADR 0030).
const FFMPEG = ['ffmpeg', '-nostdin', '-v', 'error', '-y', '-protocol_whitelist', 'file', '-max_pixels', String(MAX_CONVERTED_PIXELS), '-f']
// ffmpeg is commonly built without an SVG decoder, so it is left to the OS (ADR 0031).
const FFMPEG_DEMUXERS: Partial<Record<ConvertedFormat, string>> = { webp: 'webp_pipe', heic: 'mov', tiff: 'tiff_pipe' }
// ffmpeg reads an animated WebP's frames through a demuxer of its own, which refuses a still.
const FFMPEG_ANIMATED_WEBP_DEMUXER = 'webp_anim'

// Whether a converter keeps an animation, as a GIF: ffmpeg anywhere, the OS on macOS only.
export const convertsAnimation = (os: Os, converter: Converter) => converter === 'ffmpeg' || os === 'mac'

// Whether ffmpeg converts the format, where the person prefers it (ADR 0030).
export const ffmpegConverts = (format: ConvertedFormat) => FFMPEG_DEMUXERS[format] !== undefined

const commandFor = (os: Os, converter: Converter, { from, to, format, isAnimated, width, height }: Conversion): Command | null => {
  if (converter === 'ffmpeg') {
    const demuxer = isAnimated ? FFMPEG_ANIMATED_WEBP_DEMUXER : FFMPEG_DEMUXERS[format]
    const output = isAnimated ? ['-filter_complex', FFMPEG_GIF_FILTER, '-loop', '0'] : ['-frames:v', '1', '-update', '1']
    return demuxer === undefined ? null : { argv: [...FFMPEG, demuxer, '-i', from, ...output, to], init: {} }
  }
  if (os === 'mac') {
    if (format === 'svg') {
      return { argv: ['osascript', '-l', 'JavaScript', '-e', APPKIT_SVG_SCRIPT, from, to, String(width), String(height)], init: {} }
    }
    return isAnimated
      ? { argv: ['osascript', '-l', 'JavaScript', '-e', IMAGE_IO_GIF_SCRIPT, from, to], init: {} }
      : { argv: ['sips', '-s', 'format', 'png', from, '--out', to], init: {} }
  }
  if (os === 'windows' && format !== 'svg') {
    return {
      argv: [
        ...POWERSHELL,
        `$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName PresentationCore; $i = [IO.File]::OpenRead($env:${PATH_VARIABLE}); $d = [Windows.Media.Imaging.BitmapDecoder]::Create($i, 'None', 'OnLoad'); $i.Close(); $e = New-Object Windows.Media.Imaging.PngBitmapEncoder; $e.Frames.Add($d.Frames[0]); $o = [IO.File]::Create($env:${OUT_PATH_VARIABLE}); $e.Save($o); $o.Close()`,
      ],
      init: { env: { [PATH_VARIABLE]: from, [OUT_PATH_VARIABLE]: to } },
    }
  }
  return null
}

// Converts an image the module does not decode to a PNG of its first frame, or an animation to a GIF, within a time
// limit; null where the converter has no codec for it: the OS on Linux, an SVG anywhere but macOS (ADR 0029).
export const convertCommand = (os: Os, converter: Converter, conversion: Conversion): Command | null => {
  const command = commandFor(os, converter, conversion)
  return command && { ...command, init: { ...command.init, timeoutMs: CONVERSION_TIMEOUT_MS } }
}

const OFFSET_VARIABLE = 'MEDIA_VIEW_OFFSET'
const LENGTH_VARIABLE = 'MEDIA_VIEW_LENGTH'
// dd reads whole blocks; chunks are aligned to them.
export const READ_BLOCK_BYTES = 65536

// `$.fs.read` stops at 4 MiB and a process's output at 4 MiB too; a larger file is read as base64 slices.
export const readChunkCommand = (os: Os, path: string, offset: number, length: number): Command => {
  const env = { [PATH_VARIABLE]: path, [OFFSET_VARIABLE]: String(offset), [LENGTH_VARIABLE]: String(length) }
  if (os === 'windows') {
    return {
      argv: [
        ...POWERSHELL,
        `$f = [IO.File]::OpenRead($env:${PATH_VARIABLE}); [void]$f.Seek([long]$env:${OFFSET_VARIABLE}, 0); $b = New-Object byte[] ([int]$env:${LENGTH_VARIABLE}); $n = $f.Read($b, 0, $b.Length); $f.Close(); [Convert]::ToBase64String($b, 0, $n)`,
      ],
      init: { env },
    }
  }
  return {
    argv: [
      '/bin/sh',
      '-c',
      `dd if="$${PATH_VARIABLE}" bs=${READ_BLOCK_BYTES} skip=$((${OFFSET_VARIABLE} / ${READ_BLOCK_BYTES})) count=$((${LENGTH_VARIABLE} / ${READ_BLOCK_BYTES})) 2>/dev/null | base64`,
    ],
    init: { env },
  }
}
