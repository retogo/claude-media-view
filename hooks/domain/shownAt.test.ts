import { describe, expect, test } from 'claude-code/testing'

import { formatShownAt } from './shownAt'

describe('formatShownAt', () => {
  test('writes the local date and time to the minute', () => {
    expect(formatShownAt(new Date(2026, 9, 19, 15, 22, 41).getTime())).toBe('2026-10-19 15:22')
  })

  test('pads months, days, hours and minutes to two digits', () => {
    expect(formatShownAt(new Date(2026, 0, 5, 9, 3).getTime())).toBe('2026-01-05 09:03')
  })
})
