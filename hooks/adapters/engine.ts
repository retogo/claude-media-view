import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { isWindows, joinPath, osFrom, READ_BLOCK_BYTES, readChunkCommand, tmpRootFor } from '../domain/platform'
import { DEFAULT_SETTINGS } from '../domain/settings'
import type { Host, Ports, SeenImage } from '../usecases/ports'

const CACHE_DIRECTORY = 'media-view'
const MIB = 1024 * 1024
// $.fs.read rejects files over 4 MiB.
const FS_READ_LIMIT_BYTES = 4 * MIB
const MAX_FILE_BYTES = 64 * MIB
// Base64 of a chunk, line breaks included, stays under a process's 4 MiB of output.
const CHUNK_BYTES = 32 * READ_BLOCK_BYTES

// The gallery's records live in the session's state, which a hot reload of the module leaves (ADR 0021).
const seenImages = atom({ plugin: 'media-view', key: 'seenImages' } as const, [])
const imageTagRows = atom({ plugin: 'media-view', key: 'imageTagRows' } as const, {})
const shownAt = atom({ plugin: 'media-view', key: 'shownAt' } as const, {})
const settings = atom({ plugin: 'media-view', key: 'settings' } as const, DEFAULT_SETTINGS)

let host: Promise<Host> | undefined

async function resolveHost($: EngineInterface): Promise<Host> {
  const osVariable = await $.env.get('OS')
  const os = isWindows(osVariable) ? 'windows' : osFrom({ osVariable, uname: (await $.process.run(['uname', '-s'])).stdout })
  const tmpRoot = tmpRootFor(os, {
    claudeTmpDir: await $.env.get('CLAUDE_CODE_TMPDIR'),
    temp: os === 'windows' ? await $.env.get('TEMP') : undefined,
    uid: os === 'windows' ? undefined : (await $.process.run(['id', '-u'])).stdout.trim(),
  })
  return { os, tmpRoot, cacheRoot: joinPath(os, tmpRoot, CACHE_DIRECTORY) }
}

// Resolved once per session; an attempt a render cut short is forgotten (ADR 0007).
function sessionHost($: EngineInterface) {
  host ??= resolveHost($).catch(error => {
    host = undefined
    throw error
  })
  return host
}

// Reads a file of any size up to MAX_FILE_BYTES: small ones whole, larger ones in base64 chunks (ADR 0005).
async function readWhole($: EngineInterface, path: string) {
  const { size } = await $.fs.stat(path)
  if (size < FS_READ_LIMIT_BYTES) {
    return Uint8Array.fromBase64((await $.fs.read(path, { as: 'bytes' })).base64)
  }
  if (size > MAX_FILE_BYTES) {
    throw new Error(`${path} is ${Math.ceil(size / MIB)} MiB, over the ${MAX_FILE_BYTES / MIB} MiB media-view reads`)
  }
  const { os } = await sessionHost($)
  const bytes = new Uint8Array(size)
  for (let offset = 0; offset < size; offset += CHUNK_BYTES) {
    const { argv, init } = readChunkCommand(os, path, offset, CHUNK_BYTES)
    const read = await $.process.run(argv, init)
    if (read.exitCode !== 0) {
      throw new Error(`reading ${path} failed: ${read.stderr.trim()}`)
    }
    bytes.set(Uint8Array.fromBase64(read.stdout.replace(/\s+/g, '')).subarray(0, size - offset), offset)
  }
  return bytes
}

// Runs a state write once the current dispatch is over: a render hook may only read state.
function afterDrawing($: EngineInterface, write: () => Promise<unknown>) {
  $.clock.after(0, () => void write())
}

// The usecases' ports over this hook's `$` (ADR 0015).
export function enginePorts($: EngineInterface): Ports {
  return {
    host: () => sessionHost($),
    sessionId: () => $.session.id(),
    readFile: path => readWhole($, path),
    checkRead: path => $.tool.check({ tool: 'Read', input: { file_path: path } }),
    // A Read call runs Read's permission path, dialog included; its result is not used.
    askRead: async path => {
      const asked = await $.tool.call({ tool: 'Read', file_path: path })
      return asked.deny ?? (asked.isError ? asked.text : undefined)
    },
    // A render may not write state, and only a render knows the row: the write waits for the render to end.
    rememberSeen: async image => {
      const isKept = (images: readonly SeenImage[]) => images.some(({ key }) => key === image.key)
      if (!isKept(await read($, seenImages))) {
        afterDrawing($, () => update($, seenImages, images => (isKept(images) ? images : [...images, image])))
      }
    },
    seenImages: async () => [...(await read($, seenImages))],
    rememberImageTagRow: async (n, rowId) => {
      if ((await read($, imageTagRows))[n] === undefined) {
        afterDrawing($, () => update($, imageTagRows, rows => (rows[n] === undefined ? { ...rows, [n]: rowId } : rows)))
      }
    },
    imageTagRowOf: async n => (await read($, imageTagRows))[n],
    rememberShownAt: async key => {
      if ((await read($, shownAt))[key] === undefined) {
        const at = await $.clock.now()
        afterDrawing($, () => update($, shownAt, times => (times[key] === undefined ? { ...times, [key]: at } : times)))
      }
    },
    listDirectory: async path => (await $.fs.list(path)).map(({ name, kind }) => ({ name, kind })),
    exists: path => $.fs.exists(path),
    run: async ({ argv, init }) => {
      const ran = await $.process.run(argv, init)
      if (ran.exitCode !== 0) {
        throw new Error(`${argv[0]} exited ${ran.exitCode}: ${ran.stderr.trim()}`)
      }
    },
    convertsFormats: async () => (await read($, settings)).convertFormats,
    requestRedraw: afterMs => {
      if (afterMs === undefined) {
        $.ui.invalidate('ui.render')
      } else {
        $.clock.after(afterMs, () => $.ui.invalidate('ui.render'))
      }
    },
  }
}
