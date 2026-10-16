import { imageTagNumbers } from '../../domain/imageTags'
import { cellBox, type CellBox } from '../../domain/layout'
import type { Picture } from '../../domain/media/frameCache'
import { loadImageTag } from '../images'
import type { Ports } from '../ports'

// Pasting raises no edit event, so the draft is read on a timer.
const DRAFT_POLL_MS = 200
const MAX_TILE_COLUMNS = 24
const MAX_TILE_ROWS = 6
const LABEL_ROWS = 1
const MORE_LABEL_COLUMNS = 4
export const TILE_GAP = 1

export type Tile = { n: number; picture: Picture; box: CellBox }

// What the `AbovePrompt` band draws: the tiles that fit, and how many are left out.
export type AbovePromptTiles = { tiles: Tile[]; hidden: number }

export type DraftPorts = {
  every: (ms: number, tick: () => Promise<void>) => { cancel: () => void }
  readDraft: () => Promise<string>
  updateDraftNumbers: (change: (current: readonly number[]) => readonly number[]) => Promise<void>
}

const isSameList = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((n, i) => n === b[i])

let watch: { cancel: () => void } | undefined

// Keeps the draft's image tag numbers up to date, written only when they change.
export const watchDraft = (draft: DraftPorts) => {
  let lastDraft: string | undefined
  let isReading = false
  watch?.cancel()
  watch = draft.every(DRAFT_POLL_MS, async () => {
    if (isReading) {
      return
    }
    isReading = true
    try {
      const text = await draft.readDraft()
      if (text !== lastDraft) {
        lastDraft = text
        const numbers = imageTagNumbers(text)
        await draft.updateDraftNumbers(current => (isSameList(current, numbers) ? current : numbers))
      }
    } finally {
      isReading = false
    }
  })
}

// The tiles that fit in `columns`, keeping room for a `+N` label when some are left out.
const fitTiles = (tiles: Tile[], columns: number) => {
  const fitted: Tile[] = []
  let used = 0
  for (const tile of tiles) {
    const needed = tile.box.columns + (fitted.length > 0 ? TILE_GAP : 0)
    const reserve = fitted.length + 1 < tiles.length ? MORE_LABEL_COLUMNS : 0
    if (used + needed + reserve > columns) {
      break
    }
    fitted.push(tile)
    used += needed
  }
  return fitted
}

// The pictures of the draft's image tags, one row above the prompt; null when there are none.
export const abovePrompt = async (
  ports: Ports,
  { numbers, bodyColumns, maxRows }: { numbers: readonly number[]; bodyColumns: number; maxRows: number },
): Promise<AbovePromptTiles | null> => {
  if (numbers.length === 0) {
    return null
  }
  const sessionId = await ports.sessionId()
  const tileRows = Math.max(1, Math.min(MAX_TILE_ROWS, maxRows - LABEL_ROWS))
  const loaded = await Promise.all(numbers.map(n => loadImageTag(ports, sessionId, n).then(picture => picture && { n, picture })))
  const tiles = loaded
    .filter((item): item is { n: number; picture: Picture } => item !== null)
    .map(item => ({ ...item, box: cellBox(item.picture, { maxColumns: MAX_TILE_COLUMNS, maxRows: tileRows }) }))
  if (tiles.length === 0) {
    return null
  }
  const shown = fitTiles(tiles, bodyColumns)
  return { tiles: shown, hidden: tiles.length - shown.length }
}
