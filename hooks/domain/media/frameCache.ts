import { joinPath, type Os } from '../platform'
import type { Decoded } from './decode'
import { encodePng } from './png'

const DIRECTORY_NAME_HEX_DIGITS = 16

// A file `Image` reads itself: the shape of its `{ file, format: 'png' }` source.
export type FileSource = { file: string; format: 'png' }

export type Frame = { source: FileSource; delayMs: number }

// A decoded image on disk: every draw and blit names one of its files (ADR 0006).
export type Picture = { width: number; height: number; frames: Frame[] }

// A picture, the directory its files go in, and the files to write so that its sources exist.
export type Plan = Picture & { directory: string; writes: { path: string; bytes: Uint8Array }[] }

// Every frame is a PNG file: a PNG source as it is, decoded frames compressed.
export const framePlan = (os: Os, directory: string, decoded: Decoded): Plan => {
  const pngs =
    decoded.kind === 'png'
      ? [{ png: decoded.png, delayMs: 0 }]
      : decoded.frames.map(frame => ({ png: encodePng({ width: decoded.width, height: decoded.height, rgba: frame.rgba }), delayMs: frame.delayMs }))
  const files = pngs.map((_, i) => joinPath(os, directory, `${i}.png`))
  return {
    width: decoded.width,
    height: decoded.height,
    directory,
    writes: pngs.map(({ png }, i) => ({ path: files[i]!, bytes: png })),
    frames: pngs.map(({ delayMs }, i) => ({ source: { file: files[i]!, format: 'png' }, delayMs })),
  }
}

export const cacheDirectoryName = async (key: string) => {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, DIRECTORY_NAME_HEX_DIGITS)
}
