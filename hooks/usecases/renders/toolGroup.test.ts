import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_SETTINGS } from '../../domain/settings'
import { fakePorts } from '../ports.fake'
import { mediaViewPane } from './pane/mediaView'
import { toolGroup } from './toolGroup'

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

// A Read image output that counts how often its base64 is read.
const countedOutput = () => {
  let reads = 0
  const file = {
    type: 'image/png',
    originalSize: 1,
    get base64() {
      reads++
      return PNG_BASE64
    },
  }
  return { output: { type: 'image', file }, reads: () => reads }
}

describe('toolGroup', () => {
  test('decodes a Read image only while its picture is not cached', async () => {
    const { ports } = fakePorts()
    const { output, reads } = countedOutput()
    const calls = [{ tool_use_id: 'toolu_counted', tool: 'Read', input: { file_path: '/work/a.png' }, output }]

    await toolGroup(ports, { requestId: 'group-1', calls, viewportColumns: 80 })
    const afterFirst = reads()
    await toolGroup(ports, { requestId: 'group-1', calls, viewportColumns: 80 })

    expect(afterFirst).toBe(1)
    expect(reads()).toBe(1)
  })

  test('keeps the images it drew per session', async () => {
    const { ports } = fakePorts({}, { sessionId: async () => 'session-old' })
    const { output } = countedOutput()

    await toolGroup(ports, {
      requestId: 'group-2',
      calls: [{ tool_use_id: 'toolu_old', tool: 'Read', input: { file_path: '/work/old.png' }, output }],
      viewportColumns: 80,
    })
    const { ports: newSession } = fakePorts({}, { sessionId: async () => 'session-new' })

    expect((await mediaViewPane(newSession, { bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 }, shownAt: {}, draftNumbers: [], settings: DEFAULT_SETTINGS })).map(entry => entry.path)).toEqual([])
  })
})

