import { describe, expect, test } from 'claude-code/testing'

import { decodePng } from './png'
import { cacheDirectoryName, framePlan } from './frameCache'

describe('framePlan', () => {
  test('writes a PNG once and draws it from its file', () => {
    const png = new Uint8Array([1, 2])

    expect(framePlan('mac', '/c/k', { kind: 'png', width: 3, height: 2, png })).toEqual({
      width: 3,
      height: 2,
      directory: '/c/k',
      writes: [{ path: '/c/k/0.png', bytes: png }],
      frames: [{ source: { file: '/c/k/0.png', format: 'png' }, delayMs: 0 }],
    })
  })

  test('writes each RGBA frame as a compressed PNG', () => {
    const first = new Uint8Array(16)
    const second = new Uint8Array(16).fill(255)
    const plan = framePlan('windows', 'C:\\c\\k', {
      kind: 'rgba',
      width: 2,
      height: 2,
      frames: [
        { rgba: first, delayMs: 70, index: 0, startMs: 0 },
        { rgba: second, delayMs: 120, index: 1, startMs: 70 },
      ],
      sourceFrameCount: 2,
    })

    expect(plan.writes.map(write => write.path)).toEqual(['C:\\c\\k\\0.png', 'C:\\c\\k\\1.png'])
    expect(plan.writes.map(write => decodePng(write.bytes).rgba)).toEqual([first, second])
    expect(plan.frames).toEqual([
      { source: { file: 'C:\\c\\k\\0.png', format: 'png' }, delayMs: 70 },
      { source: { file: 'C:\\c\\k\\1.png', format: 'png' }, delayMs: 120 },
    ])
  })
})

describe('cacheDirectoryName', () => {
  test('is 16 hex digits of the key, the same for the same key', async () => {
    const name = await cacheDirectoryName('toolu_01ABC')

    expect(name).toMatch(/^[0-9a-f]{16}$/)
    expect(await cacheDirectoryName('toolu_01ABC')).toBe(name)
    expect(await cacheDirectoryName('toolu_01ABD')).not.toBe(name)
  })
})
