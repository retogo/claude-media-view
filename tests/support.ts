import type { On, UiBlitArgs } from 'claude-code'
import { mock, type Engine } from 'claude-code/testing'

export const PLUGIN = 'media-view'
export const VIEWPORT = { columns: 80, rows: 24 }

// 1x1 transparent PNG.
export const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

// 2x2, two frames (70 ms, 120 ms).
export const GIF_TWO_FRAMES =
  'R0lGODlhAgACAIEAAP///wD/AP8AAAAA/yH/C05FVFNDQVBFMi4wAwEAAAAh+QQEBwAAACwAAAAAAgACAAAIBwAFBBgAICAAIfkEBAwAAAAsAAAAAAIAAgCBAP8A/wAAAAD/AAAACAcABwQAICAgADs='

// A macOS host whose processes all succeed; returns the argv of every process run.
export const onMac = (on: On) => {
  const runs: string[][] = []
  mock.env(on, {})
  mock.store(on)
  on('fs.stat', () => ({ value: { kind: 'file', size: 1024, mtimeMs: 0, isLink: false } }))
  on('session.id', () => ({ value: 'session-1' }))
  on('process.run', (_$, e) => {
    runs.push([...e.argv])
    const stdout = e.argv[0] === 'uname' ? 'Darwin\n' : e.argv[0] === 'id' ? '501\n' : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'engine row' }))
  return runs
}

export const readCall = (id: string, base64: string, type: string) => ({
  tool_use_id: id,
  tool: 'Read',
  input: { file_path: `/pictures/${id}` },
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
  output: { type: 'image', file: { base64, type, originalSize: 1 } },
})

// A browser screenshot tool's call, its result made of API content blocks.
export const screenshotCall = (id: string, base64: string, mediaType: string) => ({
  tool_use_id: id,
  tool: 'mcp__claude-in-chrome__computer',
  input: { action: 'screenshot', tabId: 1 },
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
  output: [
    { type: 'text', text: 'Successfully captured screenshot' },
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
  ],
})

// A two-frame GIF of `width`×`height` whose frames each paint one pixel, 100 ms apart, as base64.
export const wideGif = (width: number, height: number) => {
  const word = (value: number) => [value & 0xff, value >> 8]
  const frame = [0x21, 0xf9, 4, 0, 10, 0, 0, 0, 0x2c, ...word(0), ...word(0), ...word(1), ...word(1), 0, 2, 2, 0x4c, 0x01, 0]
  const header = [...new TextEncoder().encode('GIF89a'), ...word(width), ...word(height), 0x80, 0, 0, 0, 0, 0, 255, 255, 255]
  return new Uint8Array([...header, ...frame, ...frame, 0x3b]).toBase64()
}

// The path an `fs.*` hook sees, as these tests write it: on Windows the engine resolves `/tmp/x` to `D:\tmp\x`.
export const posixPath = (path: string) => path.replace(/^[A-Za-z]:/, '').replaceAll('\\', '/')

export const entry = (name: string, kind: 'file' | 'dir') => ({ name, kind, size: 0, mtimeMs: 0, isLink: false })

// The paste cache of session `session-1` holds `5.png`.
export const onPasteCache = (on: On) => {
  on('fs.list', (_$, e) => ({
    value: posixPath(e.path) === '/tmp/claude-501' ? [entry('-Users-me', 'dir')] : posixPath(e.path).endsWith('/images') ? [entry('5.png', 'file')] : [],
  }))
  on('fs.exists', (_$, e) => ({ value: posixPath(e.path) === '/tmp/claude-501/-Users-me/session-1/images' }))
  on('fs.read', (_$, e) => (posixPath(e.path).endsWith('/5.png') ? { value: { base64: PNG_1X1 } } : { deny: `no ${e.path}` }))
}


export const PASTE_CACHE = '/tmp/claude-501/-Users-me/session-1/images'

export const PANE_PROPS = {
  title: 'Media',
  isFocused: true,
  bodyColumns: 80,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

export const runCommand = ($: Engine, args: string) =>
  $.command.run({ command: 'media-view', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })

// How often media-view reads the draft.
export const DRAFT_POLL_MS = 200

// A macOS session `session-1` with 2.png and 3.png pasted (each `pasted`, base64) and `draft` in the composer,
// which names both unless given, the plugin's store holding `stored`, and `files` there to read as the same bytes
// besides; returns the argv of every process run and the store, to read what was kept. The draft is read once.
export const startSession = async (
  $: Engine,
  on: On,
  {
    pasted = PNG_1X1,
    stored = {},
    files = [],
    draft = { text: '[Image #2] [Image #3]' },
  }: { pasted?: string; stored?: Record<string, unknown>; files?: string[]; draft?: { text: string } } = {},
) => {
  const runs: string[][] = []
  const copied: string[] = []
  const blits: UiBlitArgs[] = []
  mock.env(on, {})
  on('fs.stat', () => ({ value: { kind: 'file', size: 1024, mtimeMs: 0, isLink: false } }))
  const clock = mock.clock(on)
  on('ui.copy', (_$, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  on('ui.blit', (_$, e) => {
    blits.push(e)
    return { value: {} }
  })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('tool.register', (_$, e) => ({ value: { tool: `mcp__media-view__${e.name}` } }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('prompt.read', () => ({ value: { text: draft.text, cursor: draft.text.length } }))
  on('session.id', () => ({ value: 'session-1' }))
  on('process.run', (_$, e) => {
    runs.push([...e.argv])
    const stdout = e.argv[0] === 'uname' ? 'Darwin\n' : e.argv[0] === 'id' ? '501\n' : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.list', (_$, e) => ({ value: posixPath(e.path) === '/tmp/claude-501' ? [entry('-Users-me', 'dir')] : posixPath(e.path) === PASTE_CACHE ? [entry('2.png', 'file'), entry('3.png', 'file')] : [] }))
  on('fs.exists', (_$, e) => ({ value: posixPath(e.path) === PASTE_CACHE || files.includes(posixPath(e.path)) }))
  on('fs.read', () => ({ value: { base64: pasted } }))
  const store = new Map(Object.entries(stored))
  on('store.get', (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', (_$, e) => (store.set(e.key, e.value), { value: undefined }))
  on('store.delete', (_$, e) => (store.delete(e.key), { value: undefined }))
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'engine' }))
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(DRAFT_POLL_MS)
  return { runs, copied, blits, clock, store }
}

