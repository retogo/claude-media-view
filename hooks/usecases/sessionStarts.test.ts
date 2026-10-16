import { expect, test } from 'claude-code/testing'

import { sessionStarts } from './sessionStarts'

test('starts the draft watch and registers the frames tool and /media-view', async () => {
  const done: string[] = []

  await sessionStarts({
    watchDraft: () => {
      done.push('watch draft')
    },
    registerTool: async tool => {
      done.push(`tool ${tool.name}`)
    },
    registerCommand: async command => {
      done.push(`command ${command.name}`)
    },
  })

  expect(done).toEqual(['watch draft', 'tool frames', 'command media-view'])
})
