import { describe, expect, test } from 'claude-code/testing'

import { decodeJpeg } from './jpeg'

// 16x8, left half red, right half blue, quality 95, no chroma subsampling.
const BASELINE =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAAIABADAREAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD4vr+Uz/fw+Q6/6qD/AJrz/9k='

// The same image saved progressive.
const PROGRESSIVE =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wgARCAAIABADAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABYBAQEBAAAAAAAAAAAAAAAAAAkHCP/aAAwDAQACEAMQAAABF5Tv4hVQ1//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAQUCP//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8BP//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8BP//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEABj8CP//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8hP//aAAwDAQACAAMAAAAQA//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QP//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QP//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QP//Z'

const CHANNEL_TOLERANCE = 24
const RED = [255, 0, 0, 255]
const BLUE = [0, 0, 255, 255]

const pixelAt = (image: { width: number; rgba: Uint8Array }, x: number, y: number) =>
  Array.from(image.rgba.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4))

const isNear = (actual: number[], expected: number[]) =>
  actual.every((channel, i) => Math.abs(channel - expected[i]!) <= CHANNEL_TOLERANCE)

describe('decodeJpeg', () => {
  test('decodes a baseline JPEG to opaque RGBA', () => {
    const image = decodeJpeg(Uint8Array.fromBase64(BASELINE))

    expect([image.width, image.height, image.rgba.length]).toEqual([16, 8, 16 * 8 * 4])
    expect(isNear(pixelAt(image, 2, 4), RED)).toBe(true)
    expect(isNear(pixelAt(image, 13, 4), BLUE)).toBe(true)
  })

  test('decodes a progressive JPEG', () => {
    const image = decodeJpeg(Uint8Array.fromBase64(PROGRESSIVE))

    expect([image.width, image.height]).toEqual([16, 8])
    expect(isNear(pixelAt(image, 2, 4), RED)).toBe(true)
    expect(isNear(pixelAt(image, 13, 4), BLUE)).toBe(true)
  })
})
