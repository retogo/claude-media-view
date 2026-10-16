import { describe, expect, test } from 'claude-code/testing'

import { fakePorts } from '../ports.fake'
import { userMessage } from './userMessage'

describe('userMessage', () => {
  test('leaves image tags in a message from someone else alone: they number their own pastes', async () => {
    const { ports } = fakePorts({}, { sessionId: async () => Promise.reject(new Error('not asked')) })

    expect(await userMessage(ports, { requestId: 'row-1', text: '[Image #2] from a teammate', isFromSomeoneElse: true, viewportColumns: 80 })).toBeNull()
  })
})
