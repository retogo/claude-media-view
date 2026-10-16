import { describe, expect, test } from 'claude-code/testing'

import { imageFileName, imageTagNumbers } from './imageTags'

describe('imageTagNumbers', () => {
  test('lists each [Image #n] tag once, in order', () => {
    expect(imageTagNumbers('see [Image #5] and [Image #12], again [Image #5]')).toEqual([5, 12])
  })

  test('is empty without tags', () => {
    expect(imageTagNumbers('[Image] #3 image #4')).toEqual([])
  })
})

describe('imageFileName', () => {
  test('finds the cached file of an image tag whatever its extension', () => {
    expect(imageFileName(['1.png', '10.jpg', '2.gif'], 10)).toBe('10.jpg')
  })

  test('does not take a longer number for a shorter one', () => {
    expect(imageFileName(['15.png', '51.png'], 5)).toBeUndefined()
  })
})
