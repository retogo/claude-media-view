import { describe, expect, test } from 'claude-code/testing'

import { mediaView, type MediaViewActions } from './mediaView'

const recorder = () => {
  const done: string[] = []
  const actions: MediaViewActions = {
    openPane: async () => {
      done.push('open')
    },
    setTranscriptAnimated: async isAnimated => {
      done.push(isAnimated ? 'animate' : 'still')
    },
  }
  return { actions, done }
}

describe('mediaView', () => {
  test('opens the pane without arguments', async () => {
    const { actions, done } = recorder()

    expect(await mediaView(actions, '')).toBe('Opened the media gallery.')
    expect(done).toEqual(['open'])
  })

  test('sets transcript GIFs still or animated', async () => {
    const { actions, done } = recorder()

    expect(await mediaView(actions, ' still ')).toBe('Transcript GIFs: still.')
    expect(await mediaView(actions, 'animate')).toBe('Transcript GIFs: animated.')
    expect(done).toEqual(['still', 'animate'])
  })

  test('answers its usage for anything else, doing nothing', async () => {
    const { actions, done } = recorder()

    expect(await mediaView(actions, 'zoom')).toBe('Usage: /media-view [still|animate]')
    expect(done).toEqual([])
  })
})
