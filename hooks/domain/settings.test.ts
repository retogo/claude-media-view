import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_SETTINGS, settingsFrom, toggled } from './settings'

describe('settings', () => {
  test('are all on by default', () => {
    expect(Object.values(DEFAULT_SETTINGS).every(isOn => isOn)).toBe(true)
  })

  test('read from what was stored, keeping the default for what is missing or not a yes or no', () => {
    expect(settingsFrom({ readImages: false, toolImages: 'no', retired: false })).toEqual({ ...DEFAULT_SETTINGS, readImages: false })
  })

  test('read as the defaults when nothing was stored', () => {
    expect(settingsFrom(undefined)).toEqual(DEFAULT_SETTINGS)
  })

  test('toggle one setting, leaving the rest', () => {
    expect(toggled(DEFAULT_SETTINGS, 'replyPaths')).toEqual({ ...DEFAULT_SETTINGS, replyPaths: false })
  })
})
