import { describe, expect, test } from 'claude-code/testing'

import { PLUGIN, PNG_1X1, VIEWPORT, onMac, screenshotCall } from '../support'

describe('ToolResult', () => {
  test('draws the image an MCP tool answered with under its row', async ($, on) => {
    onMac(on)
    const { tool_use_id, tool, output } = screenshotCall('toolu_shot', PNG_1X1, 'image/png')

    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'ToolResult',
      props: { tool_use_id, tool, output, isErrored: false },
      requestId: tool_use_id,
      viewport: VIEWPORT,
    })
    const image = await ui.find({ type: 'Image' })

    expect(image?.props.source).toEqual({ file: expect.stringMatching(/\/0\.png$/), format: 'png' })
  })
})
