import { describe, expect, test } from 'claude-code/testing'

import { imageFromReadOutput } from './readOutput'

describe('imageFromReadOutput', () => {
  test('takes the bytes and media type of an image read', () => {
    const output = { type: 'image', file: { base64: 'AQID', type: 'image/gif', originalSize: 3 } }

    expect(imageFromReadOutput(output)).toEqual({ bytes: new Uint8Array([1, 2, 3]) })
  })

  test('answers null for a text read', () => {
    expect(imageFromReadOutput({ type: 'text', file: { filePath: 'a.md', content: '' } })).toBeNull()
  })
})
