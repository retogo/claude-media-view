import type { Picture } from '../domain/media/frameCache'
import type { Command, Os } from '../domain/platform'

// Where this session's files are: resolved once per session.
export type Host = { os: Os; tmpRoot: string; cacheRoot: string }

export type FileEntry = { name: string; kind: 'file' | 'dir' | 'other' }

// Read's permission verdict on a path, as `tool.check` answers it.
export type ReadVerdict = { decision: 'allow' | 'ask' | 'deny'; reason?: string }

// An image the transcript drew from a tool's result, with the row that drew it: `path` is the file a Read read,
// absent for an image a tool answered with; `label` names it, by its path or its tool; `callId` is the tool call
// that answered with it, when the row says.
export type SeenImage = { key: string; path?: string; label: string; callId?: string; rowId: string; picture: Picture }

// What the usecases need from Claude Code; adapters/engine.ts implements it over `$`.
export type Ports = {
  host: () => Promise<Host>
  sessionId: () => Promise<string>
  readFile: (path: string) => Promise<Uint8Array>
  checkRead: (path: string) => Promise<ReadVerdict>
  // Puts a Read of the path to the person, or the mode's decider: the refusal, or undefined once granted.
  askRead: (path: string) => Promise<string | undefined>
  listDirectory: (path: string) => Promise<FileEntry[]>
  exists: (path: string) => Promise<boolean>
  // Rejects when the process cannot start or exits non-zero.
  run: (command: Command) => Promise<void>
  // What the gallery saw this session, kept where a hot reload of the module does not reach (ADR 0021); the first
  // record of an image or a tag stands.
  rememberSeen: (image: SeenImage) => Promise<void>
  // Oldest first.
  seenImages: () => Promise<SeenImage[]>
  rememberImageTagRow: (n: number, rowId: string) => Promise<void>
  imageTagRowOf: (n: number) => Promise<string | undefined>
  // Asks for another draw, now or after `afterMs`.
  requestRedraw: (afterMs?: number) => void
}
