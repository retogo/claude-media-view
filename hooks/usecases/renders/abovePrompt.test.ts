import { describe, expect, test } from 'claude-code/testing'

import { watchDraft, type DraftPorts } from './abovePrompt'

// A draft watch whose timer ticks by hand.
const fakeDraft = (texts: string[]) => {
  let tick: () => Promise<void> = async () => {}
  let numbers: readonly number[] = []
  let writes = 0
  const draft: DraftPorts = {
    every: (_ms, run) => {
      tick = run
      return { cancel: () => {} }
    },
    readDraft: async () => texts.shift() ?? '',
    updateDraftNumbers: async change => {
      const next = change(numbers)
      if (next !== numbers) {
        writes++
      }
      numbers = next
    },
  }
  return { draft, tick: () => tick(), numbers: () => numbers, writes: () => writes }
}

describe('watchDraft', () => {
  test('keeps the image tag numbers of the draft', async () => {
    const watched = fakeDraft(['[Image #2] and [Image #7]'])
    watchDraft(watched.draft)

    await watched.tick()

    expect(watched.numbers()).toEqual([2, 7])
  })

  test('writes only when the numbers change', async () => {
    const watched = fakeDraft(['[Image #2]', '[Image #2] typing', '[Image #2] typing more', 'gone'])
    watchDraft(watched.draft)

    for (let i = 0; i < 4; i++) {
      await watched.tick()
    }

    expect(watched.writes()).toBe(2)
    expect(watched.numbers()).toEqual([])
  })
})
