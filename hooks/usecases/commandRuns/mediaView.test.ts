import { describe, expect, test } from 'claude-code/testing'

import { mediaView, type MediaViewActions } from './mediaView'

const recorder = () => {
  const done: string[] = []
  const actions: MediaViewActions = {
    openPane: async () => {
      done.push('open')
    },
    openSettings: async () => {
      done.push('settings')
    },
    showPane: async () => {
      done.push('show')
    },
    setTranscriptAnimated: async isAnimated => {
      done.push(isAnimated ? 'animate' : 'still')
    },
  }
  return { actions, done }
}

describe('mediaView', () => {
  // Both panes open as the engine's tabs, in the order first opened, so the settings are one tab away; a pane
  // first opened is shown, so the gallery is then shown again.
  test('opens the gallery, the settings beside it, and shows the gallery, without arguments', async () => {
    const { actions, done } = recorder()

    expect(await mediaView(actions, '')).toBe('Opened the media gallery.')
    expect(done).toEqual(['open', 'settings', 'show'])
  })

  test('sets transcript GIFs still or animated', async () => {
    const { actions, done } = recorder()

    expect(await mediaView(actions, ' still ')).toBe('Transcript GIFs: still.')
    expect(await mediaView(actions, 'animate')).toBe('Transcript GIFs: animated.')
    expect(done).toEqual(['still', 'animate'])
  })

  test('opens the gallery and then the settings with `settings`, showing the settings', async () => {
    const { actions, done } = recorder()

    expect(await mediaView(actions, 'settings')).toBe('Opened the media-view settings.')
    expect(done).toEqual(['open', 'settings'])
  })

  test('answers its usage for anything else, doing nothing', async () => {
    const { actions, done } = recorder()

    expect(await mediaView(actions, 'zoom')).toBe('Usage: /media-view [settings|still|animate]')
    expect(done).toEqual([])
  })
})
