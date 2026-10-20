import type { Picture } from '../domain/media/frameCache'
import type { Command, Os } from '../domain/platform'
import type { ShowSetting } from '../domain/settings'

// Where this session's files are: resolved once per session.
export type Host = { os: Os; tmpRoot: string; cacheRoot: string }

export type FileEntry = { name: string; kind: 'file' | 'dir' | 'other' }

// Read's permission verdict on a path, as `tool.check` answers it.
export type ReadVerdict = { decision: 'allow' | 'ask' | 'deny'; reason?: string }

// An image the transcript drew, with the row that drew it: `path` is the file it was read from, absent for an
// image a tool answered with; `label` names it, by its path or its tool; `shownAtKey` is the key its time in the
// chat is kept under (a tool call's id, a reply row's id), when there is one; `setting` is the one it was shown under.
export type SeenImage = { key: string; path?: string; label: string; shownAtKey?: string; rowId: string; setting: ShowSetting; picture: Picture }

// What the usecases need from Claude Code; adapters/engine.ts implements it over `$`.
export type Ports = {
  host: () => Promise<Host>
  sessionId: () => Promise<string>
  readFile: (path: string) => Promise<Uint8Array>
  checkRead: (path: string) => Promise<ReadVerdict>
  listDirectory: (path: string) => Promise<FileEntry[]>
  exists: (path: string) => Promise<boolean>
  // Rejects when the process cannot start or exits non-zero.
  run: (command: Command) => Promise<void>
  // Whether the person lets the OS convert the formats media-view does not decode (ADR 0029).
  convertsFormats: () => Promise<boolean>
  // Whether the person would rather ffmpeg convert them, where it is installed (ADR 0030).
  prefersFfmpeg: () => Promise<boolean>
  // Whether an ffmpeg runs from the session's PATH, found once per session.
  isFfmpegInstalled: () => Promise<boolean>
  // What the gallery saw this session, kept where a hot reload of the module does not reach (ADR 0021); the first
  // record of an image or a tag stands.
  rememberSeen: (image: SeenImage) => Promise<void>
  // Oldest first.
  seenImages: () => Promise<SeenImage[]>
  rememberImageTagRow: (n: number, rowId: string) => Promise<void>
  imageTagRowOf: (n: number) => Promise<string | undefined>
  // When an image first showed in the chat, now, for one only a render sees (ADR 0020).
  rememberShownAt: (key: string) => Promise<void>
  // Asks for another draw, now or after `afterMs`.
  requestRedraw: (afterMs?: number) => void
}
