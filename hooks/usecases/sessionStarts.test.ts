import { expect, test } from 'claude-code/testing'

import { sessionStarts } from './sessionStarts'

test('starts the draft watch and registers /media-view, and no tool', async () => {
  const done: string[] = []

  await sessionStarts({
    watchDraft: () => {
      done.push('watch draft')
    },
    registerCommand: async command => {
      done.push(`command ${command.name}`)
    },
  })

  expect(done).toEqual(['watch draft', 'command media-view'])
})
