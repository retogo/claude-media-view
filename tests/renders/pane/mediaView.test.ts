import { describe, expect, test } from 'claude-code/testing'

import { GIF_TWO_FRAMES, PANE_PROPS, PASTE_CACHE, PLUGIN, PNG_1X1, runCommand, startSession } from '../../support'

describe('/media-view', () => {
  test('lists the session’s pasted and read images in the gallery pane', async ($, on) => {
    const { clock } = await startSession($, on)
    await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'ToolGroup',
      props: {
        calls: [
          {
            tool_use_id: 'toolu_read',
            tool: 'Read',
            input: { file_path: '/work/shot.png' },
            isRunning: false,
            isErrored: false,
            isInterrupted: false,
            output: { type: 'image', file: { base64: PNG_1X1, type: 'image/png', originalSize: 1 } },
          },
        ],
        isActive: false,
        isExpanded: false,
      },
      requestId: 'group-1',
      viewport: { columns: 80, rows: 24 },
    })

    // Picture records are kept once the drawing is over.
    await clock.advance(0)
    const opened = await runCommand($, '')
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'media-view' })

    expect(opened.text).toBe('Opened the media gallery.')
    expect((await pane.findAll({ type: 'Image' })).length).toBe(3)
    expect(await pane.find({ type: 'Text', text: `${PASTE_CACHE}/2.png` })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: '/work/shot.png' })).toBeDefined()
    expect(await pane.find({ type: 'Button', key: 'show-read-toolu_read' })).toBeDefined()
  })

  test('puts each entry’s path and buttons above its picture, so they line up whatever the picture’s width', async ($, on) => {
    await startSession($, on)
    await runCommand($, '')
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'media-view' })

    type Node = { type?: string; props?: { flexDirection?: string; children?: unknown }; children?: unknown }
    const childrenOf = (node: Node): Node[] => {
      const children = node.children ?? node.props?.children
      return (Array.isArray(children) ? children.flat(Infinity) : children === undefined ? [] : [children]) as Node[]
    }
    const findEntry = (node: Node): Node | undefined =>
      childrenOf(node).some(child => child.type === 'Image') ? node : childrenOf(node).map(findEntry).find(Boolean)
    const entry = findEntry((await pane.drawn()) as Node)

    expect(entry?.props?.flexDirection).toBe('column')
    expect(childrenOf(entry!).map(child => child.type)).toEqual(['Text', 'Box', 'Image'])
  })

  test('offers to show in chat only the images the transcript drew', async ($, on) => {
    const { clock } = await startSession($, on)
    await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'UserMessage',
      props: { text: '[Image #2] look', origin: { kind: 'composer' }, isExpanded: true },
      requestId: 'message-1',
      viewport: { columns: 80, rows: 24 },
    })

    // Picture records are kept once the drawing is over.
    await clock.advance(0)
    await runCommand($, '')
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'media-view' })

    expect(await pane.find({ type: 'Button', key: 'show-paste-2' })).toBeDefined()
    expect(await pane.find({ type: 'Button', key: 'show-paste-3' })).toBeUndefined()
  })

  test('copies a path and opens a file from the gallery', async ($, on) => {
    const { runs, copied } = await startSession($, on)
    await runCommand($, '')
    await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'media-view' })

    await $.ui.press({ plugin: PLUGIN, key: 'copy-paste-2' })
    await $.ui.press({ plugin: PLUGIN, key: 'open-paste-2' })

    expect(copied).toEqual([`${PASTE_CACHE}/2.png`])
    expect(runs).toContainEqual(['open', `${PASTE_CACHE}/2.png`])
  })

  test('animates only the GIFs inside the pane’s scroll window', async ($, on) => {
    const { blits, clock } = await startSession($, on, { pasted: GIF_TWO_FRAMES })
    await runCommand($, '')

    // Each entry is its path, its buttons and a one-row picture: three rows show only the newest paste.
    await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'Pane',
      props: { ...PANE_PROPS, scroll: { offset: 0, bodyRows: 3 } },
      requestId: 'media-view',
    })
    await clock.advance(1000)

    expect(new Set(blits.map(blit => blit.key.split('@')[0]))).toEqual(new Set(['paste-3']))
  })
})
