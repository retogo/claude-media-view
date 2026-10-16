import { describe, expect, mock, test } from 'claude-code/testing'

import { encodePng } from '../../hooks/domain/media/png'
import { PLUGIN, VIEWPORT, entry, onMac, onPasteCache, posixPath } from '../support'

// The delay before a failed picture is tried again (usecases/images.ts).
const RETRY_DELAY_MS = 250

describe('UserMessage', () => {
  test('draws a pasted image under the sent prompt', async ($, on) => {
    onMac(on)
    onPasteCache(on)

    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'UserMessage',
      props: { text: '[Image #5] what is this?', origin: { kind: 'composer' }, isExpanded: true },
      requestId: 'message-1',
      viewport: VIEWPORT,
    })

    expect((await ui.find({ type: 'Image' }))?.props.source).toEqual({ file: expect.stringMatching(/\/0\.png$/), format: 'png' })
  })

  test('wraps pasted images into rows that fit a narrow terminal', async ($, on) => {
    onMac(on)
    mock.clock(on)
    const wide = encodePng({ width: 64, height: 36, rgba: new Uint8Array(64 * 36 * 4).fill(128) }).toBase64()
    on('fs.list', (_$, e) => ({
      value: posixPath(e.path) === '/tmp/claude-501' ? [entry('-Users-me', 'dir')] : ['3', '4', '5', '6'].map(n => entry(`${n}.png`, 'file')),
    }))
    on('fs.exists', (_$, e) => ({ value: posixPath(e.path) === '/tmp/claude-501/-Users-me/session-1/images' }))
    on('fs.read', () => ({ value: { base64: wide } }))

    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'UserMessage',
      props: { text: '[Image #3] [Image #4] [Image #5] [Image #6]', origin: { kind: 'composer' }, isExpanded: true },
      requestId: 'message-3',
      viewport: { columns: 60, rows: 24 },
    })

    // 56 usable columns: four in a row would be 12 wide, under the 16-column minimum, so two rows of two.
    expect((await ui.findAll({ type: 'Image' })).map(image => [image.props.columns, image.props.rows])).toEqual(Array(4).fill([27, 8]))
  })

  test('retries a picture whose write was cut short instead of failing the row', async ($, on) => {
    mock.env(on, {})
    on('fs.stat', () => ({ value: { kind: 'file', size: 1024, mtimeMs: 0, isLink: false } }))
    on('session.id', () => ({ value: 'session-1' }))
    const clock = mock.clock(on)
    let mkdirCalls = 0
    on('process.run', (_$, e) => {
      if (e.argv[0] === 'mkdir' && mkdirCalls++ === 0) {
        return { deny: 'aborted' }
      }
      const stdout = e.argv[0] === 'uname' ? 'Darwin\n' : e.argv[0] === 'id' ? '501\n' : ''
      return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    })
    on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'engine row' }))
    onPasteCache(on)
    const message = await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'UserMessage',
      props: { text: '[Image #5]', origin: { kind: 'composer' }, isExpanded: true },
      requestId: 'message-aborted',
      viewport: VIEWPORT,
    })

    expect(await message.find({ type: 'Text', text: 'engine row' })).toBeDefined()
    expect(await message.find({ type: 'Image' })).toBeUndefined()

    await clock.advance(RETRY_DELAY_MS)

    expect((await message.find({ type: 'Image' }))?.props.source).toEqual({ file: expect.stringMatching(/\/0\.png$/), format: 'png' })
    expect(mkdirCalls).toBe(2)
  })

  test('leaves a prompt without paste tags to the engine', async ($, on) => {
    onMac(on)
    onPasteCache(on)

    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'UserMessage',
      props: { text: 'hello', origin: { kind: 'composer' }, isExpanded: true },
      requestId: 'message-2',
      viewport: VIEWPORT,
    })

    expect(await ui.find({ type: 'Image' })).toBeUndefined()
  })
})

