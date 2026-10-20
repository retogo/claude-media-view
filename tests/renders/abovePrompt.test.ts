import type { On } from 'claude-code'
import { describe, expect, mock, test, type Engine } from 'claude-code/testing'

import { GIF_TWO_FRAMES, PLUGIN, PNG_1X1, entry, posixPath } from '../support'

const POLL_MS = 200

const ABOVE_PROMPT = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 12,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 0 },
  view: {},
}

// A macOS session `session-1` whose paste cache holds 3.png and 4.png, with `draft` in the composer.
const startComposing = async ($: Engine, on: On, draft: { text: string }, pasted = PNG_1X1) => {
  mock.env(on, {})
  const clock = mock.clock(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('fs.stat', () => ({ value: { kind: 'file', size: 1024, mtimeMs: 0, isLink: false } }))
  on('session.id', () => ({ value: 'session-1' }))
  on('prompt.read', () => ({ value: { text: draft.text, cursor: draft.text.length } }))
  on('process.run', (_$, e) => ({
    value: {
      exitCode: 0,
      stdout: e.argv[0] === 'uname' ? 'Darwin\n' : e.argv[0] === 'id' ? '501\n' : '',
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))
  on('fs.list', (_$, e) => ({
    value: posixPath(e.path) === '/tmp/claude-501' ? [entry('-Users-me', 'dir')] : [entry('3.png', 'file'), entry('4.png', 'file')],
  }))
  on('fs.exists', (_$, e) => ({ value: posixPath(e.path) === '/tmp/claude-501/-Users-me/session-1/images' }))
  on('fs.read', () => ({ value: { base64: pasted } }))
  on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'engine' }))
  mock.store(on)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  return clock
}

const mountBand = ($: Engine) =>
  $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: ABOVE_PROMPT, requestId: 'band' })

describe('composer preview', () => {
  test('shows each pasted image of the draft above the prompt, labelled with its number', async ($, on) => {
    const draft = { text: 'compare [Image #3] with [Image #4]' }
    const clock = await startComposing($, on, draft)

    await clock.advance(POLL_MS)
    const band = await mountBand($)

    expect((await band.findAll({ type: 'Image' })).map(image => image.props.source)).toEqual([
      { file: expect.stringMatching(/\/0\.png$/), format: 'png' },
      { file: expect.stringMatching(/\/0\.png$/), format: 'png' },
    ])
    expect(await band.find({ type: 'Text', text: '#3' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: '#4' })).toBeDefined()
  })

  test('leaves the band to the engine once the tags are gone', async ($, on) => {
    const draft = { text: '[Image #3]' }
    const clock = await startComposing($, on, draft)
    await clock.advance(POLL_MS)

    draft.text = 'no pictures'
    await clock.advance(POLL_MS)
    const band = await mountBand($)

    expect(await band.find({ type: 'Image' })).toBeUndefined()
  })
})

describe('draft watch', () => {
  test('writes the draft’s image tags only when they change', async ($, on) => {
    const draft = { text: 'typing' }
    let writes = 0
    on('state.set', (_$, e, next) => {
      writes++
      return next(e)
    })
    const clock = await startComposing($, on, draft)

    for (const text of ['typing a', 'typing ab', 'typing abc']) {
      draft.text = text
      await clock.advance(POLL_MS)
    }

    expect(writes).toBe(0)
  })
})

describe('AbovePrompt on another surface', () => {
  test('leaves the terminal band’s GIFs playing', async ($, on) => {
    const draft = { text: '[Image #3]' }
    const blits: string[] = []
    on('ui.blit', (_$, e) => {
      blits.push(e.requestId)
      return { value: {} }
    })
    const clock = await startComposing($, on, draft, GIF_TWO_FRAMES)
    await clock.advance(POLL_MS)
    await mountBand($)

    await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: ABOVE_PROMPT, requestId: 'band' })
    await clock.advance(1000)

    expect(blits.length).toBeGreaterThan(1)
  })
})
