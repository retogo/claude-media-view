import { describe, expect, test } from 'claude-code/testing'

import { toolOutputImages } from './toolOutput'

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

const loaded = (tool: string, output: unknown) => toolOutputImages(tool, output).map(load => load()?.bytes)

describe('toolOutputImages', () => {
  test('takes each base64 image block of a result made of API content blocks', () => {
    // As Claude in Chrome's screenshot stores its result.
    const output = [
      { type: 'text', text: 'Successfully captured screenshot' },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: JPEG_BYTES.toBase64() } },
      { type: 'image', source: { type: 'url', url: 'https://example.com/a.png' } },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG_BYTES.toBase64() } },
    ]

    expect(loaded('mcp__claude-in-chrome__computer', output)).toEqual([JPEG_BYTES, PNG_BYTES])
  })

  test('finds no image in a result that is not a list of blocks', () => {
    expect(loaded('mcp__server__tool', 'done')).toEqual([])
    expect(loaded('Bash', { stdout: 'image/png' })).toEqual([])
  })

  test('takes a Read image from its own record', () => {
    expect(loaded('Read', { type: 'image', file: { base64: PNG_BYTES.toBase64(), type: 'image/png' } })).toEqual([PNG_BYTES])
  })
})
