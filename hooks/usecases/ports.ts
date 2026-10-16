import type { Command, Os } from '../domain/platform'

// Where this session's files are: resolved once per session.
export type Host = { os: Os; tmpRoot: string; cacheRoot: string }

export type FileEntry = { name: string; kind: 'file' | 'dir' | 'other' }

// Read's permission verdict on a path, as `tool.check` answers it.
export type ReadVerdict = { decision: 'allow' | 'ask' | 'deny'; reason?: string }

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
  // Asks for another draw, now or after `afterMs`.
  requestRedraw: (afterMs?: number) => void
}
