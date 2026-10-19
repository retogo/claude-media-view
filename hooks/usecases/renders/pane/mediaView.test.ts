import { describe, expect, test } from 'claude-code/testing'

import { pasteShownAtKey } from '../../../domain/shownAt'
import { rememberReadPath } from '../../images'
import { fakePorts } from '../../ports.fake'
import { toolGroup } from '../toolGroup'
import { toolResult } from '../toolResult'
import { mediaViewPane } from './mediaView'

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('mediaViewPane', () => {
  test('lists the images Read results drew when the tmp root cannot be listed', async () => {
    const { ports } = fakePorts({}, {
      sessionId: async () => 'session-unlistable',
      listDirectory: async path => Promise.reject(new Error(`EACCES: ${path}`)),
    })
    await toolGroup(ports, {
      requestId: 'group-1',
      calls: [
        {
          tool_use_id: 'toolu_unlistable',
          tool: 'Read',
          input: { file_path: '/work/chart.png' },
          output: { type: 'image', file: { base64: PNG_BASE64, type: 'image/png', originalSize: 1 } },
        },
      ],
      viewportColumns: 80,
    })

    expect((await mediaViewPane(ports, { bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 }, shownAt: {}, draftNumbers: [] })).map(entry => entry.path)).toEqual(['/work/chart.png'])
  })

  test('lists an image a standalone ToolResult row drew, by the path its Read call read', async () => {
    const { ports } = fakePorts({}, { sessionId: async () => 'session-standalone' })
    rememberReadPath('toolu_standalone', '/work/standalone.png')

    await toolResult(ports, {
      toolUseId: 'toolu_standalone',
      tool: 'Read',
      output: { type: 'image', file: { base64: PNG_BASE64, type: 'image/png', originalSize: 1 } },
      viewportColumns: 80,
    })

    expect((await mediaViewPane(ports, { bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 }, shownAt: {}, draftNumbers: [] })).map(entry => [entry.path, entry.rowId])).toEqual([['/work/standalone.png', 'toolu_standalone']])
  })

  describe('images MCP tools answered with', () => {
    const SCREENSHOT_TOOL = 'mcp__claude-in-chrome__computer'
    const screenshotOutput = [
      { type: 'text', text: 'Successfully captured screenshot' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG_BASE64 } },
    ]
    const cachedFile = expect.stringMatching(/^\/tmp\/claude-501\/media-view\/[0-9a-f]{16}\/0\.png$/)
    const listed = async (ports: Parameters<typeof mediaViewPane>[0]) =>
      (await mediaViewPane(ports, { bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 }, shownAt: {}, draftNumbers: [] })).map(({ label, path, rowId }) => ({ label, path, rowId }))

    test('lists one a ToolGroup row drew, by its tool, with its cached file as its path', async () => {
      const { ports } = fakePorts({}, { sessionId: async () => 'session-shot-group' })

      await toolGroup(ports, {
        requestId: 'group-shot',
        calls: [{ tool_use_id: 'toolu_shot_group', tool: SCREENSHOT_TOOL, input: { action: 'screenshot' }, output: screenshotOutput }],
        viewportColumns: 80,
      })

      expect(await listed(ports)).toEqual([{ label: SCREENSHOT_TOOL, path: cachedFile, rowId: 'group-shot' }])
    })

    test('lists one a standalone ToolResult row drew', async () => {
      const { ports } = fakePorts({}, { sessionId: async () => 'session-shot-result' })

      await toolResult(ports, { toolUseId: 'toolu_shot_result', tool: SCREENSHOT_TOOL, output: screenshotOutput, viewportColumns: 80 })

      expect(await listed(ports)).toEqual([{ label: SCREENSHOT_TOOL, path: cachedFile, rowId: 'toolu_shot_result' }])
    })
  })

  describe('when each image showed in the chat', () => {
    test('heads an entry with the time its call answered, before its label', async () => {
      const { ports } = fakePorts({}, { sessionId: async () => 'session-timed' })
      await toolResult(ports, {
        toolUseId: 'toolu_timed',
        tool: 'mcp__claude-in-chrome__computer',
        output: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG_BASE64 } }],
        viewportColumns: 80,
      })
      const shownAt = { toolu_timed: new Date(2026, 9, 19, 15, 22).getTime() }

      const [entry] = await mediaViewPane(ports, { bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 }, shownAt, draftNumbers: [] })

      expect(entry?.heading).toBe('2026-10-19 15:22  mcp__claude-in-chrome__computer')
    })

    test('heads an entry with its label alone when the time is not known', async () => {
      const { ports } = fakePorts({}, { sessionId: async () => 'session-untimed' })
      rememberReadPath('toolu_untimed', '/work/untimed.png')
      await toolResult(ports, {
        toolUseId: 'toolu_untimed',
        tool: 'Read',
        output: { type: 'image', file: { base64: PNG_BASE64, type: 'image/png', originalSize: 1 } },
        viewportColumns: 80,
      })

      const [entry] = await mediaViewPane(ports, { bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 }, shownAt: {}, draftNumbers: [] })

      expect(entry?.heading).toBe('/work/untimed.png')
    })
  })

  // A hot reload clears the module's own variables; the ports keep what the gallery saw.
  describe('after the module was loaded again', () => {
    const PANE_ARGS = { bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 }, shownAt: {}, draftNumbers: [] }
    const kept = {
      key: 'toolu_kept',
      path: '/work/kept.png',
      label: '/work/kept.png',
      shownAtKey: 'toolu_kept',
      rowId: 'group-kept',
      picture: { width: 1, height: 1, frames: [{ source: { file: '/tmp/claude-501/media-view/0123456789abcdef/0.png', format: 'png' as const }, delayMs: 0 }] },
    }

    test('lists a tool’s image the ports kept, though no row drew it since', async () => {
      const { ports } = fakePorts({}, { seenImages: async () => [kept] })

      expect((await mediaViewPane(ports, PANE_ARGS)).map(({ label, rowId }) => ({ label, rowId }))).toEqual([{ label: '/work/kept.png', rowId: 'group-kept' }])
    })

    test('offers the row of a sent paste the ports kept', async () => {
      const pasteCache = '/tmp/claude-501/-Users-me/session-1/images'
      const { ports } = fakePorts(
        { [`${pasteCache}/3.png`]: Uint8Array.fromBase64(PNG_BASE64) },
        {
          listDirectory: async path => (path === '/tmp/claude-501' ? [{ name: '-Users-me', kind: 'dir' }] : [{ name: '3.png', kind: 'file' }]),
          exists: async path => path === pasteCache,
          imageTagRowOf: async n => (n === 3 ? 'message-3' : undefined),
        },
      )

      const sent = { ...PANE_ARGS, shownAt: { [pasteShownAtKey(3)]: 0 } }

      expect((await mediaViewPane(ports, sent)).map(({ id, rowId }) => ({ id, rowId }))).toEqual([{ id: 'paste-3', rowId: 'message-3' }])
    })
  })

  test('lays entries out below the pane’s top padding and within its side padding', async () => {
    const { ports } = fakePorts({}, { seenImages: async () => [{ key: 'toolu_pad', label: 'x'.repeat(79), rowId: 'group-pad', picture: { width: 1, height: 1, frames: [{ source: { file: '/tmp/claude-501/media-view/0123456789abcdef/0.png', format: 'png' as const }, delayMs: 0 }] } }] })

    const [entry] = await mediaViewPane(ports, { bodyColumns: 80, scroll: { offset: 0, bodyRows: 1 }, shownAt: {}, draftNumbers: [] })
    const [below] = await mediaViewPane(ports, { bodyColumns: 80, scroll: { offset: 3, bodyRows: 1 }, shownAt: {}, draftNumbers: [] })

    // The first row is padding; a 79-column heading wraps in the 78 columns inside the side padding, so the
    // entry's button row is the pane's fourth.
    expect([entry?.isVisible, below?.isVisible]).toEqual([false, true])
  })
})

