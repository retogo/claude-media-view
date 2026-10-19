import type { Command } from '../domain/platform'
import type { Ports, SeenImage } from './ports'

// Ports over an in-memory macOS host, for usecase tests: `files` maps paths to bytes.
export const fakePorts = (files: Record<string, Uint8Array> = {}, overrides: Partial<Ports> = {}) => {
  const runs: Command[] = []
  let redraws = 0
  const seen: SeenImage[] = []
  const imageTagRows = new Map<number, string>()
  const ports: Ports = {
    host: async () => ({ os: 'mac', tmpRoot: '/tmp/claude-501', cacheRoot: '/tmp/claude-501/media-view' }),
    sessionId: async () => 'session-1',
    readFile: async path => {
      const bytes = files[path]
      if (bytes === undefined) {
        throw new Error(`ENOENT: ${path}`)
      }
      return bytes
    },
    checkRead: async () => ({ decision: 'allow' }),
    askRead: async () => undefined,
    rememberSeen: async image => {
      if (!seen.some(({ key }) => key === image.key)) {
        seen.push(image)
      }
    },
    seenImages: async () => [...seen],
    rememberImageTagRow: async (n, rowId) => {
      if (!imageTagRows.has(n)) {
        imageTagRows.set(n, rowId)
      }
    },
    imageTagRowOf: async n => imageTagRows.get(n),
    rememberShownAt: async () => undefined,
    listDirectory: async () => [],
    exists: async () => false,
    run: async command => {
      runs.push(command)
    },
    requestRedraw: () => {
      redraws++
    },
    ...overrides,
  }
  return { ports, runs, redraws: () => redraws }
}
