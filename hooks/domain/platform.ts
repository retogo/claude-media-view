export type Os = 'mac' | 'linux' | 'windows'

// A process to run: its argument vector, and its stdin and extra environment.
export type Command = { argv: string[]; init: { stdin?: string; env?: Record<string, string> } }

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
