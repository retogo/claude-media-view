import type { UiBlitArgs } from 'claude-code'
import { describe, expect, mock, test, type Engine } from 'claude-code/testing'

import { GIF_TWO_FRAMES, PLUGIN, PNG_1X1, VIEWPORT, onMac, readCall, screenshotCall, wideGif } from '../support'

describe('ToolGroup', () => {
  test('draws a read PNG from its cached file under the group row', async ($, on) => {
    onMac(on)

    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'ToolGroup',
      props: { calls: [readCall('toolu_png', PNG_1X1, 'image/png')], isActive: false, isExpanded: false },
      requestId: 'group-1',
      viewport: VIEWPORT,
    })
    const image = await ui.find({ type: 'Image' })

    expect(image?.props.source).toEqual({ file: expect.stringMatching(/^\/tmp\/claude-501\/media-view\/[0-9a-f]{16}\/0\.png$/), format: 'png' })
    expect([image?.props.columns, image?.props.rows]).toEqual([1, 1])
  })

  test('draws a screenshot an MCP tool answered with beside a read image', async ($, on) => {
    onMac(on)

    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'ToolGroup',
      props: {
        calls: [readCall('toolu_read', PNG_1X1, 'image/png'), screenshotCall('toolu_shot', PNG_1X1, 'image/png')],
        isActive: false,
        isExpanded: false,
      },
      requestId: 'group-shot',
      viewport: VIEWPORT,
    })

    expect(await ui.findAll({ type: 'Image' })).toHaveLength(2)
  })

  test('animates a read GIF by swapping its frame files', async ($, on) => {
    onMac(on)
    const clock = mock.clock(on)
    const blits: UiBlitArgs[] = []
    on('ui.blit', (_$, e) => {
      blits.push(e)
      return { value: {} }
    })

    await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'ToolGroup',
      props: { calls: [readCall('toolu_gif', GIF_TWO_FRAMES, 'image/gif')], isActive: false, isExpanded: false },
      requestId: 'group-2',
      viewport: VIEWPORT,
    })
    await clock.advance(70)
    await clock.advance(120)

    expect(blits.map(blit => 'source' in blit && blit.source)).toEqual([
      expect.objectContaining({ file: expect.stringMatching(/\/1\.png$/), format: 'png' }),
      expect.objectContaining({ file: expect.stringMatching(/\/0\.png$/), format: 'png' }),
    ])
  })

  test('logs how to get pictures once when the terminal draws the alt instead', async ($, on) => {
    onMac(on)
    const clock = mock.clock(on)
    const logged: string[] = []
    on('ui.blit', () => ({ value: { deny: 'the Image draws its alt here: the terminal draws no placeholder images (bg worker)' } }))
    on('ui.log', (_$, e) => {
      logged.push(e.text)
      return { value: undefined }
    })

    for (const requestId of ['group-4', 'group-5']) {
      await $.ui.mount({
        plugin: PLUGIN,
        surface: 'terminal',
        component: 'ToolGroup',
        props: { calls: [readCall(`toolu_${requestId}`, PNG_1X1, 'image/png')], isActive: false, isExpanded: false },
        requestId,
        viewport: VIEWPORT,
      })
    }
    await clock.advance(0)

    expect(logged).toEqual([expect.stringContaining('background sessions draw no pictures')])
  })

  test('leaves a group without images to the engine', async ($, on) => {
    onMac(on)

    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'ToolGroup',
      props: {
        calls: [{ ...readCall('toolu_text', '', ''), output: { type: 'text', file: { filePath: 'a.md', content: '' } } }],
        isActive: false,
        isExpanded: false,
      },
      requestId: 'group-3',
      viewport: VIEWPORT,
    })

    expect(await ui.find({ type: 'Image' })).toBeUndefined()
  })
})

describe('GIF loops', () => {
  const mountGif = ($: Engine, requestId: string) =>
    $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'ToolGroup',
      props: { calls: [readCall(`toolu_${requestId}`, GIF_TWO_FRAMES, 'image/gif')], isActive: false, isExpanded: false },
      requestId,
      viewport: VIEWPORT,
    })

  test('stays stopped when a stop lands while a blit is in flight', async ($, on) => {
    onMac(on)
    const clock = mock.clock(on)
    let release: () => void = () => {}
    const blits: UiBlitArgs[] = []
    on('ui.blit', (_$, e) => {
      blits.push(e)
      return new Promise(resolve => {
        release = () => resolve({ value: {} })
      })
    })

    await mountGif($, 'group-stop')
    await clock.advance(70)
    await $.command.run({ command: 'media-view', args: 'still', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
    release()
    await clock.advance(1000)

    expect(blits.length).toBe(1)
  })

  test('starts no more loops once the terminal has refused pictures', async ($, on) => {
    onMac(on)
    const clock = mock.clock(on)
    on('ui.log', () => ({ value: undefined }))
    let blits = 0
    on('ui.blit', () => {
      blits++
      return { value: { deny: 'the Image draws its alt here: the terminal draws no placeholder images (inside tmux or screen)' } }
    })

    await mountGif($, 'group-denied-1')
    await clock.advance(70)
    await mountGif($, 'group-denied-2')
    await clock.advance(1000)

    expect(blits).toBe(1)
  })

  // A pane opening or closing narrows or widens the transcript; the terminal keeps an unchanged source at its old size.
  describe('drawn again at another width', () => {
    const WIDE = wideGif(400, 100)
    const NARROW_VIEWPORT = { columns: 30, rows: 24 }
    const mountAt = ($: Engine, viewport: { columns: number; rows: number }) =>
      $.ui.mount({
        plugin: PLUGIN,
        surface: 'terminal',
        component: 'ToolGroup',
        props: { calls: [readCall('toolu_wide', WIDE, 'image/gif')], isActive: false, isExpanded: false },
        requestId: 'group-resized',
        viewport,
      })

    test('draws a new Image for the new size', async ($, on) => {
      onMac(on)
      mock.clock(on)
      on('ui.blit', () => ({ value: {} }))

      const wideUi = await mountAt($, VIEWPORT)
      const wide = await wideUi.find({ type: 'Image' })
      await wideUi.unmount()
      const narrow = await (await mountAt($, NARROW_VIEWPORT)).find({ type: 'Image' })

      expect(Number(narrow?.props.columns)).toBeLessThan(Number(wide?.props.columns))
      expect(narrow?.key).not.toBe(wide?.key)
    })

    test('stops the old size’s GIF loop', async ($, on) => {
      onMac(on)
      const clock = mock.clock(on)
      const blitted: string[] = []
      on('ui.blit', (_$, e) => {
        blitted.push(e.key)
        return { value: {} }
      })

      const wideUi = await mountAt($, VIEWPORT)
      await clock.advance(100)
      await wideUi.unmount()
      const narrow = await (await mountAt($, NARROW_VIEWPORT)).find({ type: 'Image' })
      blitted.length = 0
      await clock.advance(100)
      await clock.advance(100)

      expect(new Set(blitted)).toEqual(new Set([narrow?.key]))
    })
  })
})
