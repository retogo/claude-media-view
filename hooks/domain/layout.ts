// A terminal cell is about twice as tall as it is wide.
const CELL_ASPECT = 2

export type Size = { width: number; height: number }
export type CellBox = { columns: number; rows: number }

export type RowLimits = { width: number; gap: number; maxColumns: number; maxRows: number; minColumns: number }

const columnsEach = (count: number, width: number, gap: number) => Math.floor((width - gap * (count - 1)) / count)

// Pictures side by side within `width`: shrunk evenly to fit one row, or wrapped into
// balanced rows when one row would make them narrower than `minColumns`.
export const arrangeInRows = (pictures: readonly Size[], { width, gap, maxColumns, maxRows, minColumns }: RowLimits): CellBox[][] => {
  const fitPerRow = Math.max(1, Math.floor((width + gap) / (minColumns + gap)))
  const fitsOneRow = pictures.length <= fitPerRow && columnsEach(pictures.length, width, gap) >= minColumns
  const perRow = fitsOneRow ? pictures.length : Math.ceil(pictures.length / Math.ceil(pictures.length / fitPerRow))
  const limit = { maxColumns: Math.max(1, Math.min(maxColumns, columnsEach(perRow, width, gap))), maxRows }
  return Array.from({ length: Math.ceil(pictures.length / perRow) }, (_, row) =>
    pictures.slice(row * perRow, (row + 1) * perRow).map(picture => cellBox(picture, limit)),
  )
}

// The largest box of cells within the limits that keeps the picture's aspect ratio.
export const cellBox = (picture: Size, { maxColumns, maxRows }: { maxColumns: number; maxRows: number }): CellBox => {
  const columns = Math.max(1, Math.min(maxColumns, picture.width))
  const rows = Math.max(1, Math.round((columns * picture.height) / picture.width / CELL_ASPECT))
  if (rows <= maxRows) {
    return { columns, rows }
  }
  return { columns: Math.max(1, Math.round((maxRows * CELL_ASPECT * picture.width) / picture.height)), rows: maxRows }
}
