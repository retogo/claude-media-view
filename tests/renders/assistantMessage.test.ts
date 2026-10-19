import { describe, expect, test, type Engine } from 'claude-code/testing'

import { PANE_PROPS, PLUGIN, VIEWPORT, runCommand, startSession } from '../support'

const CHART = '/work/out/chart.png'

const mountReply = ($: Engine, requestId: string) =>
  $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'AssistantMessage',
    props: { text: `I saved the chart to ${CHART}.`, isFirstOfReply: true },
    requestId,
    viewport: VIEWPORT,
  })

describe('AssistantMessage', () => {
  test('draws an image file the reply names under it', async ($, on) => {
    on('tool.check', { tool: 'Read' }, () => ({ decision: 'allow' }))
    await startSession($, on, { files: [CHART] })

    const image = await (await mountReply($, 'reply-on')).find({ type: 'Image' })

    expect(image?.props.source).toEqual({ file: expect.stringMatching(/\/0\.png$/), format: 'png' })
  })

  test('draws a WebP the reply names, as the PNG the OS converts it to', async ($, on) => {
    const PHOTO = '/work/out/photo.webp'
    // 3x2 lossy WebP.
    const WEBP = 'UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoDAAIAAsBMJaACdLoAA5gA/u2QP4hd7G2//PTP62/j/xkAAAA='
    on('tool.check', { tool: 'Read' }, () => ({ decision: 'allow' }))
    const { runs } = await startSession($, on, { files: [PHOTO], contents: { [PHOTO]: WEBP } })

    const image = await (
      await $.ui.mount({
        plugin: PLUGIN,
        surface: 'terminal',
        component: 'AssistantMessage',
        props: { text: `The photo is at ${PHOTO}.`, isFirstOfReply: true },
        requestId: 'reply-webp',
        viewport: VIEWPORT,
      })
    ).find({ type: 'Image' })

    expect(image?.props.source).toEqual({ file: expect.stringMatching(/\/0\.png$/), format: 'png' })
    expect(runs.find(argv => argv[0] === 'sips')).toEqual(['sips', '-s', 'format', 'png', expect.stringMatching(/\/source$/), '--out', expect.stringMatching(/\/source\.png$/)])
  })

  test('converts with ffmpeg where it runs from PATH, and with the OS once the person stops preferring it', async ($, on) => {
    const PHOTO = '/work/out/photo.webp'
    // 3x2 lossy WebP.
    const WEBP = 'UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoDAAIAAsBMJaACdLoAA5gA/u2QP4hd7G2//PTP62/j/xkAAAA='
    const mountReply = (requestId: string, path: string) =>
      $.ui.mount({
        plugin: PLUGIN,
        surface: 'terminal',
        component: 'AssistantMessage',
        props: { text: `The photo is at ${path}.`, isFirstOfReply: true },
        requestId,
        viewport: VIEWPORT,
      })
    on('tool.check', { tool: 'Read' }, () => ({ decision: 'allow' }))
    const OTHER = '/work/out/other.webp'
    const { runs } = await startSession($, on, { files: [PHOTO, OTHER], contents: { [PHOTO]: WEBP, [OTHER]: WEBP }, hasFfmpeg: true })

    expect(await (await mountReply('reply-ffmpeg', PHOTO)).find({ type: 'Image' })).toBeDefined()
    expect(runs.filter(argv => ['ffmpeg', 'sips'].includes(argv[0]!)).map(argv => argv.at(-1) === '-version' ? 'ffmpeg -version' : argv[0])).toEqual(['ffmpeg -version', 'ffmpeg'])

    await runCommand($, 'settings')
    const settings = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'media-view-settings' })
    await settings.press({ key: 'setting-preferFfmpeg' })
    const runsBefore = runs.length
    await mountReply('reply-os', OTHER)

    expect(runs.slice(runsBefore).map(argv => argv[0])).toContain('sips')
    expect(runs.slice(runsBefore).map(argv => argv[0])).not.toContain('ffmpeg')
  })

  test('hands a WebP the reply names to no converter while conversion is off, and draws it once turned on', async ($, on) => {
    const PHOTO = '/work/out/photo.webp'
    // 3x2 lossy WebP.
    const WEBP = 'UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoDAAIAAsBMJaACdLoAA5gA/u2QP4hd7G2//PTP62/j/xkAAAA='
    const mountPhotoReply = (requestId: string) =>
      $.ui.mount({
        plugin: PLUGIN,
        surface: 'terminal',
        component: 'AssistantMessage',
        props: { text: `The photo is at ${PHOTO}.`, isFirstOfReply: true },
        requestId,
        viewport: VIEWPORT,
      })
    on('tool.check', { tool: 'Read' }, () => ({ decision: 'allow' }))
    const { runs } = await startSession($, on, { files: [PHOTO], contents: { [PHOTO]: WEBP }, stored: { settings: { convertFormats: false } } })

    expect(await (await mountPhotoReply('reply-webp-off')).find({ type: 'Image' })).toBeUndefined()
    expect(runs.some(argv => argv[0] === 'sips')).toBe(false)

    await runCommand($, 'settings')
    const settings = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'media-view-settings' })
    await settings.press({ key: 'setting-convertFormats' })

    expect(await (await mountPhotoReply('reply-webp-on')).find({ type: 'Image' })).toBeDefined()
  })

  test('leaves the reply alone when image files named in replies are turned off', async ($, on) => {
    on('tool.check', { tool: 'Read' }, () => ({ decision: 'allow' }))
    await startSession($, on, { files: [CHART], stored: { settings: { assistantMessages: false } } })

    expect(await (await mountReply($, 'reply-off')).find({ type: 'Image' })).toBeUndefined()
  })
})
