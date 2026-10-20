import { describe, expect, test } from 'claude-code/testing'

import type { ConvertedFormat } from './media/decode'
import { convertCommand, convertsAnimation, ffmpegConverts, makeDirectoryCommand, openCommand, osFrom, readChunkCommand, tmpRootFor, writeBytesCommand } from './platform'

// Every ffmpeg conversion reads only local files, decodes no frame past the pixel cap, and names its demuxer.
const FFMPEG_INPUT = ['ffmpeg', '-nostdin', '-v', 'error', '-y', '-protocol_whitelist', 'file', '-max_pixels', '24000000', '-f']

describe('openCommand', () => {
  test('opens a file in the OS viewer', () => {
    expect(openCommand('mac', '/p/a b.png')).toEqual({ argv: ['open', '/p/a b.png'], init: {} })
    // xdg-open waits for some viewers to exit; started in the background it returns at once.
    expect(openCommand('linux', '/p/a.png')).toEqual({
      argv: ['/bin/sh', '-c', 'xdg-open "$MEDIA_VIEW_PATH" >/dev/null 2>&1 &'],
      init: { env: { MEDIA_VIEW_PATH: '/p/a.png' } },
    })
    expect(openCommand('windows', 'C:\\p\\a.png')).toEqual({
      argv: ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', 'Start-Process -FilePath $env:MEDIA_VIEW_PATH'],
      init: { env: { MEDIA_VIEW_PATH: 'C:\\p\\a.png' } },
    })
  })
})

describe('osFrom', () => {
  test('reads Windows from the OS variable', () => {
    expect(osFrom({ osVariable: 'Windows_NT', uname: undefined })).toBe('windows')
  })

  test('reads macOS and Linux from uname', () => {
    expect(osFrom({ osVariable: undefined, uname: 'Darwin\n' })).toBe('mac')
    expect(osFrom({ osVariable: undefined, uname: 'Linux\n' })).toBe('linux')
  })
})

describe('tmpRootFor', () => {
  test('is /tmp/claude-<uid> on macOS and Linux by default', () => {
    expect(tmpRootFor('mac', { claudeTmpDir: undefined, temp: undefined, uid: '501' })).toBe('/tmp/claude-501')
    expect(tmpRootFor('linux', { claudeTmpDir: undefined, temp: undefined, uid: '1000' })).toBe('/tmp/claude-1000')
  })

  test('takes CLAUDE_CODE_TMPDIR as the base', () => {
    expect(tmpRootFor('mac', { claudeTmpDir: '/var/tmp/', temp: undefined, uid: '501' })).toBe('/var/tmp/claude-501')
  })

  test('is %TEMP%\\claude on Windows', () => {
    expect(tmpRootFor('windows', { claudeTmpDir: undefined, temp: 'C:\\Users\\me\\AppData\\Local\\Temp', uid: undefined })).toBe(
      'C:\\Users\\me\\AppData\\Local\\Temp\\claude',
    )
  })
})

describe('writeBytesCommand', () => {
  const bytes = new Uint8Array([104, 105])

  test('decodes base64 from stdin into the file through sh on macOS and Linux', () => {
    expect(writeBytesCommand('mac', '/tmp/a b.rgba', bytes)).toEqual({
      argv: ['/bin/sh', '-c', 'base64 -d > "$MEDIA_VIEW_PATH"'],
      init: { stdin: 'aGk=', env: { MEDIA_VIEW_PATH: '/tmp/a b.rgba' } },
    })
  })

  test('decodes base64 from stdin into the file through PowerShell on Windows', () => {
    expect(writeBytesCommand('windows', 'C:\\t\\0.rgba', bytes)).toEqual({
      argv: [
        'powershell.exe',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[IO.File]::WriteAllBytes($env:MEDIA_VIEW_PATH, [Convert]::FromBase64String([Console]::In.ReadToEnd()))',
      ],
      init: { stdin: 'aGk=', env: { MEDIA_VIEW_PATH: 'C:\\t\\0.rgba' } },
    })
  })
})

describe('makeDirectoryCommand', () => {
  test('creates the directory and its parents', () => {
    expect(makeDirectoryCommand('linux', '/c/k')).toEqual({ argv: ['mkdir', '-p', '/c/k'], init: {} })
    expect(makeDirectoryCommand('windows', 'C:\\c\\k')).toEqual({
      argv: ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', 'New-Item -ItemType Directory -Force -Path $env:MEDIA_VIEW_PATH | Out-Null'],
      init: { env: { MEDIA_VIEW_PATH: 'C:\\c\\k' } },
    })
  })
})

describe('readChunkCommand', () => {
  test('prints a 64 KiB-aligned slice of a file as base64 through dd on macOS and Linux', () => {
    expect(readChunkCommand('linux', '/p/big.gif', 2097152, 2097152)).toEqual({
      argv: [
        '/bin/sh',
        '-c',
        'dd if="$MEDIA_VIEW_PATH" bs=65536 skip=$((MEDIA_VIEW_OFFSET / 65536)) count=$((MEDIA_VIEW_LENGTH / 65536)) 2>/dev/null | base64',
      ],
      init: { env: { MEDIA_VIEW_PATH: '/p/big.gif', MEDIA_VIEW_OFFSET: '2097152', MEDIA_VIEW_LENGTH: '2097152' } },
    })
  })

  test('prints a slice as base64 through PowerShell on Windows', () => {
    expect(readChunkCommand('windows', 'C:\\p\\big.gif', 0, 2097152)).toEqual({
      argv: [
        'powershell.exe',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '$f = [IO.File]::OpenRead($env:MEDIA_VIEW_PATH); [void]$f.Seek([long]$env:MEDIA_VIEW_OFFSET, 0); $b = New-Object byte[] ([int]$env:MEDIA_VIEW_LENGTH); $n = $f.Read($b, 0, $b.Length); $f.Close(); [Convert]::ToBase64String($b, 0, $n)',
      ],
      init: { env: { MEDIA_VIEW_PATH: 'C:\\p\\big.gif', MEDIA_VIEW_OFFSET: '0', MEDIA_VIEW_LENGTH: '2097152' } },
    })
  })
})

describe('convertCommand', () => {
  const still = (from: string, to: string, format: ConvertedFormat = 'webp') => ({ from, to, format, isAnimated: false, width: 3, height: 2 })
  // Every conversion is given up on past a time limit, as an SVG can take long to draw at any size.
  const TIMEOUT = { timeoutMs: 10_000 }

  test('converts a still with sips on macOS', () => {
    expect(convertCommand('mac', 'os', still('/c/a b/source', '/c/a b/source.png'))).toEqual({
      argv: ['sips', '-s', 'format', 'png', '/c/a b/source', '--out', '/c/a b/source.png'],
      init: TIMEOUT,
    })
  })

  test('converts an animation to a GIF through ImageIO from JavaScript for Automation on macOS', () => {
    const command = convertCommand('mac', 'os', { from: '/c/source', to: '/c/source.gif', format: 'webp', isAnimated: true, width: 64, height: 64 })

    expect(command?.argv.slice(0, 4)).toEqual(['osascript', '-l', 'JavaScript', '-e'])
    expect(command?.argv[4]).toContain("$('com.compuserve.gif')")
    expect(command?.argv.slice(5)).toEqual(['/c/source', '/c/source.gif'])
  })

  test('converts with ffmpeg on any OS where it is the converter: a still to PNG, an animation to a GIF of its own palette', () => {
    expect(convertCommand('linux', 'ffmpeg', still('/c/source', '/c/source.png'))).toEqual({
      argv: [...FFMPEG_INPUT, 'webp_pipe', '-i', '/c/source', '-frames:v', '1', '-update', '1', '/c/source.png'],
      init: TIMEOUT,
    })
    expect(convertCommand('windows', 'ffmpeg', { from: 'C:\\c\\source', to: 'C:\\c\\source.gif', format: 'webp', isAnimated: true, width: 64, height: 64 })).toEqual({
      argv: [...FFMPEG_INPUT, 'webp_anim', '-i', 'C:\\c\\source', '-filter_complex', 'split[a][b];[a]palettegen[p];[b][p]paletteuse', '-loop', '0', 'C:\\c\\source.gif'],
      init: TIMEOUT,
    })
  })

  test('reads with ffmpeg only local files, only by the demuxer of the format sniffed, and no frame past the pixel cap', () => {
    const demuxerOf = (format: ConvertedFormat) => convertCommand('mac', 'ffmpeg', still('/c/source', '/c/source.png', format))?.argv[FFMPEG_INPUT.length]

    expect((['webp', 'heic', 'tiff'] as const).map(demuxerOf)).toEqual(['webp_pipe', 'mov', 'tiff_pipe'])
  })

  test('keeps an animation only where the converter can: ffmpeg anywhere, the OS on macOS', () => {
    expect(convertsAnimation('mac', 'os')).toBe(true)
    expect(convertsAnimation('windows', 'os')).toBe(false)
    expect(convertsAnimation('linux', 'ffmpeg')).toBe(true)
    expect(convertsAnimation('windows', 'ffmpeg')).toBe(true)
  })

  test('converts the first frame through the Windows Imaging Component on Windows', () => {
    expect(convertCommand('windows', 'os', still('C:\\c\\source', 'C:\\c\\source.png'))).toEqual({
      argv: [
        'powershell.exe',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName PresentationCore; $i = [IO.File]::OpenRead($env:MEDIA_VIEW_PATH); $d = [Windows.Media.Imaging.BitmapDecoder]::Create($i, 'None', 'OnLoad'); $i.Close(); $e = New-Object Windows.Media.Imaging.PngBitmapEncoder; $e.Frames.Add($d.Frames[0]); $o = [IO.File]::Create($env:MEDIA_VIEW_OUT_PATH); $e.Save($o); $o.Close()",
      ],
      init: { env: { MEDIA_VIEW_PATH: 'C:\\c\\source', MEDIA_VIEW_OUT_PATH: 'C:\\c\\source.png' }, ...TIMEOUT },
    })
  })

  test('has no OS converter on Linux', () => {
    expect(convertCommand('linux', 'os', still('/c/source', '/c/source.png'))).toBeNull()
  })

  test('draws an SVG at its size through AppKit from JavaScript for Automation on macOS, and nowhere else', () => {
    const svg = { from: '/c/source', to: '/c/source.png', format: 'svg', isAnimated: false, width: 800, height: 400 } as const
    const command = convertCommand('mac', 'os', svg)

    expect(command?.argv.slice(0, 4)).toEqual(['osascript', '-l', 'JavaScript', '-e'])
    expect(command?.argv[4]).toContain('drawInRectFromRectOperationFraction')
    expect(command?.argv.slice(5)).toEqual(['/c/source', '/c/source.png', '800', '400'])
    expect(command?.init).toEqual(TIMEOUT)
    expect(convertCommand('windows', 'os', { ...svg, from: 'C:\\c\\source', to: 'C:\\c\\source.png' })).toBeNull()
    expect(convertCommand('linux', 'os', svg)).toBeNull()
  })

  test('leaves SVG to the OS: ffmpeg converts WebP, HEIC and TIFF', () => {
    expect((['webp', 'heic', 'tiff', 'svg'] as const).map(ffmpegConverts)).toEqual([true, true, true, false])
  })
})
