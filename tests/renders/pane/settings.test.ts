import { describe, expect, test, type Engine } from 'claude-code/testing'

import { PANE_PROPS, PLUGIN, PNG_1X1, VIEWPORT, readCall, runCommand, screenshotCall, startSession } from '../../support'

const mountSettings = async ($: Engine) => {
  await runCommand($, 'settings')
  return $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'media-view-settings' })
}

const mountGroup = ($: Engine, requestId: string, calls: unknown[]) =>
  $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolGroup',
    props: { calls, isActive: false, isExpanded: false } as never,
    requestId,
    viewport: VIEWPORT,
  })

describe('/media-view settings', () => {
  test('lists what media-view draws, every one on by default', async ($, on) => {
    await startSession($, on)

    const pane = await mountSettings($)

    expect((await pane.findAll({ type: 'Button' })).map(button => button.key)).toEqual([
      'setting-abovePrompt',
      'setting-sentPastes',
      'setting-readImages',
      'setting-toolImages',
      'setting-replyPaths',
      'setting-animateGifs',
    ])
    expect(await pane.find({ type: 'Button', key: 'setting-readImages', text: '[x] Images Claude reads' })).toBeDefined()
  })

  test('turns one off with a press, keeps it, and draws no such image after', async ($, on) => {
    const { store } = await startSession($, on)
    const pane = await mountSettings($)

    await pane.press({ key: 'setting-readImages' })

    expect(await pane.find({ type: 'Button', key: 'setting-readImages', text: '[ ] Images Claude reads' })).toBeDefined()
    expect(store.get('settings')).toMatchObject({ readImages: false, toolImages: true })
    expect(await (await mountGroup($, 'group-off', [readCall('toolu_off', PNG_1X1, 'image/png')])).find({ type: 'Image' })).toBeUndefined()
  })

  test('starts a session with the settings the store kept', async ($, on) => {
    await startSession($, on, { stored: { settings: { toolImages: false } } })

    const group = await mountGroup($, 'group-kept', [readCall('toolu_read_kept', PNG_1X1, 'image/png'), screenshotCall('toolu_shot_kept', PNG_1X1, 'image/png')])

    expect(await group.findAll({ type: 'Image' })).toHaveLength(1)
  })

  test('opens from its command alone: the gallery has no button of its own for it', async ($, on) => {
    await startSession($, on)
    await runCommand($, '')

    const gallery = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'media-view' })

    expect(await gallery.find({ type: 'Button', text: 'Settings' })).toBeUndefined()
  })

  test('draws both panes inside a padding below the tabs and from the frame', async ($, on) => {
    await startSession($, on)

    for (const pane of [await mountSettings($), await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'media-view' })]) {
      expect(await pane.drawn()).toMatchObject({ props: { paddingTop: 1, paddingX: 1 } })
    }
  })
})

