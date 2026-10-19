import { describe, expect, test } from 'claude-code/testing'

import { mediaViewClosed } from './mediaView'

const recorder = () => {
  const done: string[] = []
  const actions = {
    stopPaneAnimations: () => {
      done.push('stop')
    },
    closePane: async (id: string) => {
      done.push(`close ${id}`)
    },
  }
  return { actions, done }
}

describe('mediaViewClosed', () => {
  test('closes the settings with the gallery when the person closes it, and stops its GIFs', async () => {
    const { actions, done } = recorder()

    await mediaViewClosed({ paneId: 'media-view', closedBy: 'person' }, actions)

    expect(done).toEqual(['stop', 'close media-view-settings'])
  })

  test('closes the gallery with the settings when the person closes them', async () => {
    const { actions, done } = recorder()

    await mediaViewClosed({ paneId: 'media-view-settings', closedBy: 'person' }, actions)

    expect(done).toEqual(['close media-view'])
  })

  test('closes nothing more for a close the person did not make, nor for another pane', async () => {
    const { actions, done } = recorder()

    await mediaViewClosed({ paneId: 'media-view', closedBy: 'plugin' }, actions)
    await mediaViewClosed({ paneId: 'media-view-settings', closedBy: 'unload' }, actions)
    await mediaViewClosed({ paneId: 'someone-else', closedBy: 'person' }, actions)

    expect(done).toEqual(['stop'])
  })
})
