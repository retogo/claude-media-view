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

  test('leaves the reply alone when image files named in replies are turned off', async ($, on) => {
    on('tool.check', { tool: 'Read' }, () => ({ decision: 'allow' }))
    await startSession($, on, { files: [CHART], stored: { settings: { replyPaths: false } } })

    expect(await (await mountReply($, 'reply-off')).find({ type: 'Image' })).toBeUndefined()
  })
})
