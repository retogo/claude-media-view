import { describe, expect, test } from 'claude-code/testing'

import { decodePng, encodePng } from '../../domain/media/png'
import { frames } from './frames'

// 16x8 baseline JPEG.
const JPEG_16X8 = Uint8Array.fromBase64('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAAIABADAREAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD4vr+Uz/fw+Q6/6qD/AJrz/9k=')

const PNG_1X1 = encodePng({ width: 1, height: 1, rgba: new Uint8Array(4) })

// crypto.getRandomValues fills at most 65536 bytes a call.
const RANDOM_BYTES_PER_CALL = 65536

// Read may read every path, so frames is never asked about.
const permitted = {
  checkRead: async () => ({ decision: 'allow' as const }),
  askRead: async () => undefined,
}

const reading = (bytes: Uint8Array) => ({ ...permitted, readFile: async () => bytes })

const imageOf = (answer: Awaited<ReturnType<typeof frames>>) =>
  'result' in answer ? answer.result.find(block => block.type === 'image') : undefined

describe('frames', () => {
  test('refuses a file that is not a PNG, GIF or JPEG without reading it', async () => {
    const read: string[] = []

    const answer = await frames({ ...permitted, readFile: async path => (read.push(path), new Uint8Array()) }, { path: '/work/clip.webp' })

    expect(answer).toEqual({ deny: 'clip.webp is not a PNG, GIF or JPEG image' })
    expect(read).toEqual([])
  })

  test('names a still by its content, not its extension', async () => {
    const answer = await frames(reading(JPEG_16X8), { path: '/work/photo.png' })

    expect(imageOf(answer)).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: JPEG_16X8.toBase64() } })
  })

  test('scales a still past the API limits down to 1568 px and sends it as PNG', async () => {
    const wide = encodePng({ width: 9000, height: 2, rgba: new Uint8Array(9000 * 2 * 4).fill(90) })

    const image = imageOf(await frames(reading(wide), { path: '/work/panorama.png' }))
    const sent = image?.type === 'image' ? decodePng(Uint8Array.fromBase64(image.source.data)) : undefined

    expect(image?.type === 'image' && image.source.media_type).toBe('image/png')
    expect([sent?.width, sent?.height]).toEqual([1568, 1])
  })

  test('refuses a file whose content is no image', async () => {
    expect(await frames(reading(new TextEncoder().encode('not an image')), { path: '/work/fake.gif' })).toEqual({
      deny: 'fake.gif is not a PNG, GIF or JPEG image',
    })
  })
})

describe('frames limits', () => {
  test('scales a still past 2000 px, the limit once a request holds more than 20 images', { timeoutMs: 60_000 }, async () => {
    const screenshot = encodePng({ width: 2880, height: 1800, rgba: new Uint8Array(2880 * 1800 * 4).fill(200) })

    const image = imageOf(await frames(reading(screenshot), { path: '/work/screenshot.png' }))
    const sent = image?.type === 'image' ? decodePng(Uint8Array.fromBase64(image.source.data)) : undefined

    expect([sent?.width, sent?.height]).toEqual([1568, 980])
  })

  test('scales a still further while its PNG is over the 5 MB the API takes', { timeoutMs: 60_000 }, async () => {
    // Random pixels do not compress: a PNG of them is as big as its pixels.
    const noise = new Uint8Array(1600 * 800 * 4)
    for (let at = 0; at < noise.length; at += RANDOM_BYTES_PER_CALL) {
      crypto.getRandomValues(noise.subarray(at, at + RANDOM_BYTES_PER_CALL))
    }
    const photo = encodePng({ width: 1600, height: 800, rgba: noise })

    const image = imageOf(await frames(reading(photo), { path: '/work/noise.png' }))

    expect(image?.type === 'image' && image.source.data.length).toBeLessThanOrEqual(5_000_000)
  })

  test('refuses with the reason when the file cannot be read', async () => {
    const answer = await frames({ ...permitted, readFile: async () => Promise.reject(new Error('/work/huge.gif is 100 MiB, over the 64 MiB media-view reads')) }, { path: '/work/huge.gif' })

    expect(answer).toEqual({ deny: 'huge.gif could not be read: /work/huge.gif is 100 MiB, over the 64 MiB media-view reads' })
  })
})

describe('frames permission', () => {
  test('refuses with Read’s reason, reading nothing, where Read is denied', async () => {
    const read: string[] = []
    const asked: string[] = []

    const answer = await frames(
      {
        checkRead: async () => ({ decision: 'deny', reason: 'Permission to read /home/me/.ssh/id.png has been denied.' }),
        askRead: async path => (asked.push(path), undefined),
        readFile: async path => (read.push(path), PNG_1X1),
      },
      { path: '/home/me/.ssh/id.png' },
    )

    expect(answer).toEqual({ deny: 'Permission to read /home/me/.ssh/id.png has been denied.' })
    expect([read, asked]).toEqual([[], []])
  })

  test('puts the path to the person through Read where Read would ask, then reads it', async () => {
    const asked: string[] = []

    const answer = await frames(
      {
        checkRead: async () => ({ decision: 'ask' }),
        askRead: async path => (asked.push(path), undefined),
        readFile: async () => PNG_1X1,
      },
      { path: '/elsewhere/dot.png' },
    )

    expect(asked).toEqual(['/elsewhere/dot.png'])
    expect(imageOf(answer)).toBeDefined()
  })

  test('refuses with the answer where the person refuses', async () => {
    const answer = await frames(
      {
        checkRead: async () => ({ decision: 'ask' }),
        askRead: async () => 'The user doesn’t want to proceed with this tool use.',
        readFile: async () => PNG_1X1,
      },
      { path: '/elsewhere/dot.png' },
    )

    expect(answer).toEqual({ deny: 'The user doesn’t want to proceed with this tool use.' })
  })
})
