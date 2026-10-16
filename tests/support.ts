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

export const entry = (name: string, kind: 'file' | 'dir') => ({ name, kind, size: 0, mtimeMs: 0, isLink: false })

// The paste cache of session `session-1` holds `5.png`.
export const onPasteCache = (on: On) => {
  on('fs.list', (_$, e) => ({
    value: e.path === '/tmp/claude-501' ? [entry('-Users-me', 'dir')] : e.path.endsWith('/images') ? [entry('5.png', 'file')] : [],
  }))
  on('fs.exists', (_$, e) => ({ value: e.path === '/tmp/claude-501/-Users-me/session-1/images' }))
  on('fs.read', (_$, e) => (e.path.endsWith('/5.png') ? { value: { base64: PNG_1X1 } } : { deny: `no ${e.path}` }))
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

// A macOS session `session-1` with 2.png pasted; returns the argv of every process run.
export const startSession = async ($: Engine, on: On, pasted = PNG_1X1) => {
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
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('session.id', () => ({ value: 'session-1' }))
  on('process.run', (_$, e) => {
    runs.push([...e.argv])
    const stdout = e.argv[0] === 'uname' ? 'Darwin\n' : e.argv[0] === 'id' ? '501\n' : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.list', (_$, e) => ({ value: e.path === '/tmp/claude-501' ? [entry('-Users-me', 'dir')] : e.path === PASTE_CACHE ? [entry('2.png', 'file'), entry('3.png', 'file')] : [] }))
  on('fs.exists', (_$, e) => ({ value: e.path === PASTE_CACHE }))
  on('fs.read', () => ({ value: { base64: pasted } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'engine' }))
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  return { runs, copied, blits, clock }
}

