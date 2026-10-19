import { describe, expect, test, type Engine } from 'claude-code/testing'

import { PLUGIN, VIEWPORT, startSession } from '../support'

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
    // The first bytes of a WebP: RIFF, its size, WEBP.
    const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20])
    on('tool.check', { tool: 'Read' }, () => ({ decision: 'allow' }))
    const { runs } = await startSession($, on, { files: [PHOTO], contents: { [PHOTO]: WEBP.toBase64() } })

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

  test('leaves the reply alone when image files named in replies are turned off', async ($, on) => {
    on('tool.check', { tool: 'Read' }, () => ({ decision: 'allow' }))
    await startSession($, on, { files: [CHART], stored: { settings: { assistantMessages: false } } })

    expect(await (await mountReply($, 'reply-off')).find({ type: 'Image' })).toBeUndefined()
  })
})
