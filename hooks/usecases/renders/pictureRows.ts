import { arrangeInRows, type CellBox } from '../../domain/layout'
import type { Picture } from '../../domain/media/frameCache'

const MAX_COLUMNS = 40
const MAX_ROWS = 20
// Narrower than this, pictures wrap onto another row instead of shrinking further.
const MIN_COLUMNS = 16
const GUTTER_COLUMNS = 4
const DEFAULT_VIEWPORT_COLUMNS = 80
export const PICTURE_GAP = 2

// A picture under a transcript row, keyed for its `Image` and blit loop.
export type Shown = { key: string; picture: Picture }
export type Placed = Shown & { box: CellBox }

// What a transcript row draws under the engine's own row: pictures in rows that fit its width.
export type PictureRows = Placed[][]

export const isShown = (item: Shown | null): item is Shown => item !== null

export const placeInRows = (shown: readonly Shown[], viewportColumns: number | undefined): PictureRows => {
  const rows = arrangeInRows(
    shown.map(({ picture }) => picture),
    {
      width: (viewportColumns ?? DEFAULT_VIEWPORT_COLUMNS) - GUTTER_COLUMNS,
      gap: PICTURE_GAP,
      maxColumns: MAX_COLUMNS,
      maxRows: MAX_ROWS,
      minColumns: MIN_COLUMNS,
    },
  )
  let placed = 0
  return rows.map(boxes => boxes.map(box => ({ ...shown[placed++]!, box })))
}
