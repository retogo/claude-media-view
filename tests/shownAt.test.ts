import { describe, expect, test } from 'claude-code/testing'

import { formatShownAt } from '../hooks/domain/shownAt'
import { PANE_PROPS, PASTE_CACHE, PLUGIN, PNG_1X1, runCommand, startSession } from './support'

const SHOT_TOOL = 'mcp__shot__take'

// A Text query matches by inclusion; these match a whole heading.
const exactly = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

declare module 'claude-code' {
  interface McpToolInputs {
    mcp__shot__take: Record<never, never>
  }
}

describe('the gallery’s times', () => {
  test('heads an image a tool answered with by the time the call answered', async ($, on) => {
    let callId = ''
    const output = [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG_1X1 } }]
    on('tool.call', { tool: SHOT_TOOL }, (_$, e) => {
      callId = e.tool_use_id
      return { result: output }
    })
    const { clock } = await startSession($, on)

    await $.tool.call({ tool: SHOT_TOOL })
    const answeredAt = clock.now()
    await clock.advance(60_000)
    await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'ToolResult',
      props: { tool_use_id: callId, tool: SHOT_TOOL, output, isErrored: false },
      requestId: callId,
      viewport: { columns: 80, rows: 24 },
    })
    await clock.advance(0)
    await runCommand($, '')
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'media-view' })

    expect(await pane.find({ type: 'Text', text: exactly(`${formatShownAt(answeredAt)}  ${SHOT_TOOL}`) })).toBeDefined()
  })

  test('heads a pasted image by the time its prompt was sent, and one still in the draft by its path alone', async ($, on) => {
    on('prompt.submit', (_$, e) => ({ text: e.text }))
    const { clock } = await startSession($, on)

    await $.prompt.submit({ text: 'what is in [Image #3]?', wait: false, origin: { kind: 'composer' } })
    const sentAt = clock.now()
    await runCommand($, '')
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'media-view' })

    expect(await pane.find({ type: 'Text', text: exactly(`${formatShownAt(sentAt)}  ${PASTE_CACHE}/3.png`) })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: exactly(`${PASTE_CACHE}/2.png`) })).toBeDefined()
  })

  test('leaves a pasted image untimed when another agent’s prompt names its tag', async ($, on) => {
    on('prompt.submit', (_$, e) => ({ text: e.text }))
    await startSession($, on)

    await $.prompt.submit({ text: 'see [Image #3]', wait: false, origin: { kind: 'peer' } })
    await runCommand($, '')
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'media-view' })

    expect(await pane.find({ type: 'Text', text: exactly(`${PASTE_CACHE}/3.png`) })).toBeDefined()
  })

  test('lists the image shown last first, whatever showed it', async ($, on) => {
    let callId = ''
    const output = [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG_1X1 } }]
    on('tool.call', { tool: SHOT_TOOL }, (_$, e) => {
      callId = e.tool_use_id
      return { result: output }
    })
    on('prompt.submit', (_$, e) => ({ text: e.text }))
    const draft = { text: '[Image #3]' }
    const { clock } = await startSession($, on, { draft })

    await $.prompt.submit({ text: draft.text, wait: false, origin: { kind: 'composer' } })
    draft.text = '[Image #2]'
    await clock.advance(60_000)
    await $.tool.call({ tool: SHOT_TOOL })
    await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'ToolResult',
      props: { tool_use_id: callId, tool: SHOT_TOOL, output, isErrored: false },
      requestId: callId,
      viewport: { columns: 80, rows: 24 },
    })
    await clock.advance(0)
    await runCommand($, '')
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'media-view' })

    // The paste still in the draft has not shown in the chat yet, and leads.
    const order = (await pane.findAll({ type: 'Button' })).map(button => button.key).filter(key => key?.startsWith('copy-'))
    expect(order).toEqual(['copy-paste-2', `copy-read-${callId}`, 'copy-paste-3'])
  })
})
