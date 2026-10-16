import { describe, expect, test } from 'claude-code/testing'

import { arrangeInRows, cellBox } from './layout'

describe('arrangeInRows', () => {
  const wide = { width: 1000, height: 560 }
  const limits = { width: 156, gap: 2, maxColumns: 40, maxRows: 20, minColumns: 16 }

  test('keeps pictures at their own size when the row fits', () => {
    expect(arrangeInRows([wide, wide], limits)).toEqual([[{ columns: 40, rows: 11 }, { columns: 40, rows: 11 }]])
  })

  test('shrinks every picture evenly so one row fits the width', () => {
    expect(arrangeInRows([wide, wide, wide, wide], limits)).toEqual([Array(4).fill({ columns: 37, rows: 10 })])
  })

  test('wraps into balanced rows when one row would go below the minimum', () => {
    expect(arrangeInRows([wide, wide, wide, wide], { ...limits, width: 60 })).toEqual([
      [{ columns: 29, rows: 8 }, { columns: 29, rows: 8 }],
      [{ columns: 29, rows: 8 }, { columns: 29, rows: 8 }],
    ])
  })

  test('gives a single picture the whole width when it is narrower than the limit', () => {
    expect(arrangeInRows([wide], { ...limits, width: 30 })).toEqual([[{ columns: 30, rows: 8 }]])
  })
})

describe('cellBox', () => {
  test('keeps the aspect ratio with cells twice as tall as wide', () => {
    expect(cellBox({ width: 128, height: 104 }, { maxColumns: 20, maxRows: 40 })).toEqual({ columns: 20, rows: 8 })
  })

  test('shrinks the width when the height would pass the row limit', () => {
    expect(cellBox({ width: 100, height: 400 }, { maxColumns: 40, maxRows: 10 })).toEqual({ columns: 5, rows: 10 })
  })

  test('never draws an image larger than one cell per pixel', () => {
    expect(cellBox({ width: 4, height: 4 }, { maxColumns: 40, maxRows: 40 })).toEqual({ columns: 4, rows: 2 })
  })

  test('is at least one cell each way', () => {
    expect(cellBox({ width: 1000, height: 1 }, { maxColumns: 10, maxRows: 10 })).toEqual({ columns: 10, rows: 1 })
  })
})
