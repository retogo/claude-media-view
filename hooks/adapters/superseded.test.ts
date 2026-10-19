import { describe, expect, test } from 'claude-code/testing'

import { drawnUnlessSuperseded } from './superseded'

const failing = async (): Promise<string> => {
  throw new Error('HooksError')
}

describe('drawnUnlessSuperseded', () => {
  test('answers in place of a draw that failed after a newer draw aborted it', async () => {
    const dispatch = new AbortController()
    dispatch.abort()

    expect(await drawnUnlessSuperseded(dispatch.signal, failing, () => 'superseded')).toBe('superseded')
  })

  test('throws on a failure of a draw still under way', async () => {
    await expect(drawnUnlessSuperseded(new AbortController().signal, failing, () => 'superseded')).rejects.toThrow('HooksError')
  })

  test('answers what the draw drew', async () => {
    expect(await drawnUnlessSuperseded(new AbortController().signal, async () => 'drawn', () => 'superseded')).toBe('drawn')
  })
})
