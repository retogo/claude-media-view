import { describe, expect, test } from 'claude-code/testing'

import { GIF_TWO_FRAMES, PLUGIN, runCommand, startSession } from '../support'

describe('/media-view still and animate', () => {
  test('turns transcript animation off and on', async ($, on) => {
    const { blits, clock } = await startSession($, on)
    const mountGif = (requestId: string) =>
      $.ui.mount({
        plugin: PLUGIN,
        surface: 'terminal',
        component: 'ToolGroup',
        props: {
          calls: [
            {
              tool_use_id: `toolu_${requestId}`,
              tool: 'Read',
              input: { file_path: '/work/wave.gif' },
              isRunning: false,
              isErrored: false,
              isInterrupted: false,
              output: { type: 'image', file: { base64: GIF_TWO_FRAMES, type: 'image/gif', originalSize: 1 } },
            },
          ],
          isActive: false,
          isExpanded: false,
        },
        requestId,
        viewport: { columns: 80, rows: 24 },
      })

    expect((await runCommand($, 'still')).text).toBe('Transcript GIFs: still.')
    await mountGif('group-still')
    await clock.advance(200)
    expect(blits).toEqual([])

    expect((await runCommand($, 'animate')).text).toBe('Transcript GIFs: animated.')
    await mountGif('group-animated')
    await clock.advance(200)
    expect(blits.length).toBeGreaterThan(0)
  })
})
