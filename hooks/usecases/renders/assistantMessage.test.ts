import { describe, expect, test } from 'claude-code/testing'

import { encodePng } from '../../domain/media/png'
import { fakePorts } from '../ports.fake'
import { assistantMessage } from './assistantMessage'

const PNG = encodePng({ width: 2, height: 1, rgba: new Uint8Array(8) })
const REPLY = 'I saved the chart to /work/out/chart.png.'

describe('assistantMessage', () => {
  test('draws an image a reply names, once Read may read it, and keeps it for the gallery', async () => {
    const { ports } = fakePorts({ '/work/out/chart.png': PNG }, { exists: async path => path === '/work/out/chart.png' })

    const rows = await assistantMessage(ports, { requestId: 'reply-1', text: REPLY, viewportColumns: 80 })

    expect(rows?.flat().map(({ picture }) => picture.width)).toEqual([2])
    expect((await ports.seenImages()).map(({ label, rowId, shownAtKey }) => ({ label, rowId, shownAtKey }))).toEqual([
      { label: '/work/out/chart.png', rowId: 'reply-1', shownAtKey: 'reply-1' },
    ])
  })

  test('leaves a path Read would ask about undrawn and unread, asking nobody', async () => {
    const read: string[] = []
    const asked: string[] = []
    const { ports } = fakePorts({}, {
      checkRead: async () => ({ decision: 'ask' }),
      askRead: async path => (asked.push(path), undefined),
      exists: async () => true,
      readFile: async path => (read.push(path), PNG),
    })

    expect(await assistantMessage(ports, { requestId: 'reply-2', text: REPLY, viewportColumns: 80 })).toBeNull()
    expect([read, asked]).toEqual([[], []])
  })

  test('leaves a path to no file undrawn, without retrying', async () => {
    const { ports, redraws } = fakePorts()

    expect(await assistantMessage(ports, { requestId: 'reply-3', text: REPLY, viewportColumns: 80 })).toBeNull()
    expect(redraws()).toBe(0)
  })

  test('leaves a reply naming no image to the engine', async () => {
    const { ports } = fakePorts()

    expect(await assistantMessage(ports, { requestId: 'reply-4', text: 'Done.', viewportColumns: 80 })).toBeNull()
  })
})
