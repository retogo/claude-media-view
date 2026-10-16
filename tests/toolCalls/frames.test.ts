import type { On } from 'claude-code'
import { describe, expect, mock, test, type Engine } from 'claude-code/testing'

import { GIF_TWO_FRAMES, PNG_1X1, posixPath } from '../support'

const TOOL = 'mcp__media-view__frames'

const pngBlock = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: expect.any(String) } }

type Decision = 'allow' | 'ask' | 'deny'

// Read's verdict on each path; every path is allowed unless the test says otherwise.
const startWith = async ($: Engine, on: On, files: Record<string, string>, readDecision: (path: string) => { decision: Decision; reason?: string } = () => ({ decision: 'allow' })) => {
  mock.env(on, {})
  mock.clock(on)
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('fs.stat', (_$, e) => (files[posixPath(e.path)] === undefined ? { deny: `ENOENT: ${e.path}` } : { value: { kind: 'file', size: Uint8Array.fromBase64(files[posixPath(e.path)]!).length, mtimeMs: 0, isLink: false } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('tool.register', (_$, e) => ({ value: { tool: `mcp__media-view__${e.name}` } }))
  on('fs.read', (_$, e) => (files[posixPath(e.path)] === undefined ? { deny: `ENOENT: ${e.path}` } : { value: { base64: files[posixPath(e.path)]! } }))
  on('tool.check', { tool: 'Read' }, (_$, e) => readDecision((e.input as { file_path: string }).file_path))
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
}

describe('frames tool', () => {
  test('hands the model every frame of a short GIF, each after its label', async ($, on) => {
    await startWith($, on, { '/work/wave.gif': GIF_TWO_FRAMES })

    const called = await $.tool.call({ tool: TOOL, path: '/work/wave.gif' })

    expect(called.result).toEqual([
      { type: 'text', text: 'wave.gif: GIF, 2 frames, 2×2 px, 0.19 s. Showing all 2 frames.' },
      { type: 'text', text: 'Frame 1 of 2, at 0.00 s, shown 70 ms' },
      pngBlock,
      { type: 'text', text: 'Frame 2 of 2, at 0.07 s, shown 120 ms' },
      pngBlock,
    ])
  })

  test('samples evenly when the GIF has more frames than asked for', async ($, on) => {
    await startWith($, on, { '/work/wave.gif': GIF_TWO_FRAMES })

    const called = await $.tool.call({ tool: TOOL, path: '/work/wave.gif', maxFrames: 1 })

    expect(called.result).toEqual([
      { type: 'text', text: 'wave.gif: GIF, 2 frames, 2×2 px, 0.19 s. Showing 1 of 2 frames: 1.' },
      // The one frame sent is shown until the GIF ends: its own 70 ms and the 120 ms of the frame left out.
      { type: 'text', text: 'Frame 1 of 2, at 0.00 s, shown 190 ms' },
      pngBlock,
    ])
  })

  test('hands a still image over as it is', async ($, on) => {
    await startWith($, on, { '/work/dot.png': PNG_1X1 })

    const called = await $.tool.call({ tool: TOOL, path: '/work/dot.png' })

    expect(called.result).toEqual([
      { type: 'text', text: 'dot.png: PNG, 1×1 px, a still image.' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG_1X1 } },
    ])
  })

  test('refuses a file it cannot decode', async ($, on) => {
    await startWith($, on, { '/work/notes.txt': 'aGk=' })

    const called = await $.tool.call({ tool: TOOL, path: '/work/notes.txt' })

    expect(called.deny).toBe('notes.txt is not a PNG, GIF or JPEG image')
  })
})

describe('frames tool on files of 4 MiB and more', () => {
  test('reads the file in chunks through a process', async ($, on) => {
    const MIB = 1024 * 1024
    // A 1x1 PNG padded to 5 MiB: decoders stop at IEND.
    const file = new Uint8Array(5 * MIB)
    file.set(Uint8Array.fromBase64(PNG_1X1))
    mock.env(on, {})
    mock.clock(on)
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    on('tool.register', (_$, e) => ({ value: { tool: `mcp__media-view__${e.name}` } }))
    on('command.register', (_$, e) => ({ value: { command: e.name } }))
    on('fs.stat', () => ({ value: { kind: 'file', size: file.length, mtimeMs: 0, isLink: false } }))
    on('fs.read', (_$, e) => ({ deny: `${e.path} is over 4 MiB` }))
    on('tool.check', { tool: 'Read' }, () => ({ decision: 'allow' }))
    on('process.run', (_$, e) => {
      const offset = Number(e.init?.env?.MEDIA_VIEW_OFFSET ?? 0)
      const length = Number(e.init?.env?.MEDIA_VIEW_LENGTH ?? 0)
      const stdout = e.argv[0] === 'uname' ? 'Darwin\n' : e.argv[0] === 'id' ? '501\n' : file.subarray(offset, offset + length).toBase64()
      return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    })
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

    const called = await $.tool.call({ tool: TOOL, path: '/work/padded.png' })

    expect(called.result).toEqual([
      { type: 'text', text: 'padded.png: PNG, 1×1 px, a still image. Scaled to 1×1 px.' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: expect.any(String) } },
    ])
  })
})

describe('frames tool permission', () => {
  test('reads nothing Read may not: a denied path is refused with Read’s reason', async ($, on) => {
    await startWith($, on, { '/secret/key.png': PNG_1X1 }, () => ({
      decision: 'deny',
      reason: 'Permission to read /secret/key.png has been denied.',
    }))

    const called = await $.tool.call({ tool: TOOL, path: '/secret/key.png' })

    expect(called.deny).toBe('Permission to read /secret/key.png has been denied.')
  })

  test('asks through a Read call where Read would ask, and refuses when that is refused', async ($, on) => {
    const reads: string[] = []
    on('tool.call', { tool: 'Read' }, (_$, e) => (reads.push(e.file_path), { deny: 'you haven’t granted it yet' }))
    await startWith($, on, { '/elsewhere/dot.png': PNG_1X1 }, () => ({ decision: 'ask' }))

    const called = await $.tool.call({ tool: TOOL, path: '/elsewhere/dot.png' })

    expect(reads).toEqual(['/elsewhere/dot.png'])
    expect(called.deny).toBe('you haven’t granted it yet')
  })
})
