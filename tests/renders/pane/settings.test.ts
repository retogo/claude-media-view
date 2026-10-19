import { describe, expect, test, type Engine } from 'claude-code/testing'

import { DRAFT_POLL_MS, PANE_PROPS, PASTE_CACHE, PLUGIN, PNG_1X1, VIEWPORT, readCall, runCommand, screenshotCall, startSession } from '../../support'

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

const mountGallery = async ($: Engine) => {
  await runCommand($, '')
  return $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'media-view' })
}

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

  describe('turned off and on again, for the images already shown', () => {
    test('takes a drawn row’s picture away and draws it again', async ($, on) => {
      await startSession($, on)
      const group = await mountGroup($, 'group-shown', [readCall('toolu_shown', PNG_1X1, 'image/png')])
      const settings = await mountSettings($)

      await settings.press({ key: 'setting-readImages' })
      expect(await group.find({ type: 'Image' })).toBeUndefined()

      await settings.press({ key: 'setting-readImages' })
      expect(await group.find({ type: 'Image' })).toBeDefined()
    })

    test('leaves the gallery’s images of that setting out, and lists them again', async ($, on) => {
      const { clock } = await startSession($, on, { draft: { text: '' } })
      await mountGroup($, 'group-both', [readCall('toolu_both', PNG_1X1, 'image/png'), screenshotCall('toolu_shot_both', PNG_1X1, 'image/png')])
      await clock.advance(0)
      const gallery = await mountGallery($)
      const settings = await mountSettings($)

      await settings.press({ key: 'setting-readImages' })
      expect(await gallery.find({ type: 'Text', text: '/pictures/toolu_both' })).toBeUndefined()
      expect(await gallery.find({ type: 'Text', text: 'mcp__claude-in-chrome__computer' })).toBeDefined()

      await settings.press({ key: 'setting-readImages' })
      expect(await gallery.find({ type: 'Text', text: '/pictures/toolu_both' })).toBeDefined()
    })

    test('lists a paste in the draft by the setting above the prompt, and a sent one by the sent prompts’ setting', async ($, on) => {
      on('prompt.submit', (_$, e) => ({ text: e.text }))
      const draft = { text: '[Image #2]' }
      const { clock } = await startSession($, on, { draft })
      await $.prompt.submit({ text: draft.text, wait: false, origin: { kind: 'composer' } })
      draft.text = '[Image #3]'
      await clock.advance(DRAFT_POLL_MS)
      const gallery = await mountGallery($)
      const settings = await mountSettings($)

      await settings.press({ key: 'setting-abovePrompt' })
      expect(await gallery.find({ type: 'Text', text: `${PASTE_CACHE}/3.png` })).toBeUndefined()
      expect(await gallery.find({ type: 'Text', text: `${PASTE_CACHE}/2.png` })).toBeDefined()

      await settings.press({ key: 'setting-sentPastes' })
      expect(await gallery.find({ type: 'Text', text: `${PASTE_CACHE}/2.png` })).toBeUndefined()
    })
  })
})
