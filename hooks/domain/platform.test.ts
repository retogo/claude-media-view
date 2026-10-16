import { describe, expect, test } from 'claude-code/testing'

import { makeDirectoryCommand, openCommand, osFrom, readChunkCommand, tmpRootFor, writeBytesCommand } from './platform'

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
