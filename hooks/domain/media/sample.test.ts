import { describe, expect, test } from 'claude-code/testing'

import { sampleIndices } from './sample'

describe('sampleIndices', () => {
  test('keeps every frame when there are no more than the cap', () => {
    expect(sampleIndices(5, 12)).toEqual([0, 1, 2, 3, 4])
  })

  test('spreads the cap evenly, keeping the first and the last frame', () => {
    expect(sampleIndices(55, 12)).toEqual([0, 5, 10, 15, 20, 25, 29, 34, 39, 44, 49, 54])
  })

  test('takes the first frame alone when the cap is one', () => {
    expect(sampleIndices(10, 1)).toEqual([0])
  })
})
