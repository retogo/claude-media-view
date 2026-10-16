import { describe, expect, test } from 'claude-code/testing'

import { rememberReadPath } from '../../images'
import { fakePorts } from '../../ports.fake'
import { toolGroup } from '../toolGroup'
import { toolResult } from '../toolResult'
import { mediaViewPane } from './mediaView'

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('mediaViewPane', () => {
  test('lists the images Read results drew when the tmp root cannot be listed', async () => {
    const { ports } = fakePorts({}, {
      sessionId: async () => 'session-unlistable',
      listDirectory: async path => Promise.reject(new Error(`EACCES: ${path}`)),
    })
    await toolGroup(ports, {
      requestId: 'group-1',
      calls: [
        {
          tool_use_id: 'toolu_unlistable',
          tool: 'Read',
          input: { file_path: '/work/chart.png' },
          output: { type: 'image', file: { base64: PNG_BASE64, type: 'image/png', originalSize: 1 } },
        },
      ],
      viewportColumns: 80,
    })

    expect((await mediaViewPane(ports, { bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 } })).map(entry => entry.path)).toEqual(['/work/chart.png'])
  })

  test('lists an image a standalone ToolResult row drew, by the path its Read call read', async () => {
    const { ports } = fakePorts({}, { sessionId: async () => 'session-standalone' })
    rememberReadPath('toolu_standalone', '/work/standalone.png')

    await toolResult(ports, {
      toolUseId: 'toolu_standalone',
      tool: 'Read',
      output: { type: 'image', file: { base64: PNG_BASE64, type: 'image/png', originalSize: 1 } },
      viewportColumns: 80,
    })

    expect((await mediaViewPane(ports, { bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 } })).map(entry => [entry.path, entry.rowId])).toEqual([['/work/standalone.png', 'toolu_standalone']])
  })
})
