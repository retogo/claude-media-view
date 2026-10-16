import { describe, expect, test } from 'claude-code/testing'

import { noticeFor } from './blitDeny'

describe('noticeFor', () => {
  test('tells background sessions how to force pictures on', () => {
    expect(noticeFor('the Image draws its alt here: the terminal draws no placeholder images (bg worker)')).toBe(
      'media-view: background sessions draw no pictures. Add "CLAUDE_CODE_FORCE_TERMINAL_IMAGES": "1" to the env block of ~/.claude/settings.json; it applies at once.',
    )
  })

  test('tells tmux users to pass graphics through', () => {
    expect(noticeFor('the Image draws its alt here: the terminal draws no placeholder images (inside tmux or screen)')).toBe(
      'media-view: tmux and screen draw no pictures by default. Run `tmux set -g allow-passthrough on` and add "CLAUDE_CODE_FORCE_TERMINAL_IMAGES": "1" to the env block of ~/.claude/settings.json.',
    )
  })

  test('names the terminal limit when it cannot read local files', () => {
    expect(noticeFor('the Image draws its alt here: this terminal cannot read files on this machine (ssh)')).toBe(
      'media-view: this terminal cannot read files on this machine (ssh), so pictures cannot be shown.',
    )
  })

  test('falls back to the engine’s reason for any other terminal', () => {
    expect(noticeFor('the Image draws its alt here: the terminal draws no placeholder images (no answer)')).toBe(
      'media-view: this terminal shows no pictures (no answer). Pictures need the kitty graphics protocol with Unicode placeholders: Ghostty or kitty.',
    )
  })

  test('says nothing for denials that are not about the terminal', () => {
    expect(noticeFor('nothing of this plugin is mounted there')).toBeUndefined()
  })
})
