import { describe, expect, test } from 'claude-code/testing'

import { imagePathsIn } from './imagePaths'

describe('imagePathsIn', () => {
  test('finds absolute paths of PNG, GIF and JPEG files in prose, without the punctuation after them', () => {
    const text = 'Saved to /var/folders/zr/T/screenshot-1.jpg. The chart is at /work/out/chart.PNG, and /tmp/a.gif too.'

    expect(imagePathsIn(text)).toEqual(['/var/folders/zr/T/screenshot-1.jpg', '/work/out/chart.PNG', '/tmp/a.gif'])
  })

  test('lists each path once, in the order they first appear', () => {
    expect(imagePathsIn('/a/x.png then /b/y.jpeg then /a/x.png')).toEqual(['/a/x.png', '/b/y.jpeg'])
  })

  test('takes a path in backticks whole, spaces included', () => {
    expect(imagePathsIn('Here: `/Users/me/Desktop/Screen Shot 2026-10-19.png`')).toEqual(['/Users/me/Desktop/Screen Shot 2026-10-19.png'])
  })

  test('takes a Windows path, with either separator', () => {
    expect(imagePathsIn('Wrote C:\\Users\\me\\out\\shot.png and D:/out/plot.png')).toEqual(['C:\\Users\\me\\out\\shot.png', 'D:/out/plot.png'])
  })

  test('leaves network and device paths alone, in prose or in backticks: reaching one can hand a server credentials', () => {
    // Windows reads `/` and `\\` alike, so `/\\host` names a share as `//host` does.
    const text =
      'See //attacker/share/a.png, `//attacker/share/b.png`, \\\\attacker\\share\\c.png, \\\\?\\C:\\d.png, ' +
      '/\\attacker\\share\\e.png, `/\\attacker\\share\\f.png` and C:\\\\attacker\\g.png'

    expect(imagePathsIn(text)).toEqual([])
  })

  test('leaves URLs, relative paths and other formats alone', () => {
    const text = 'See https://example.com/a.png, docs/b.png, ./c.png, /d/e.webp and /f/g.png.txt'

    expect(imagePathsIn(text)).toEqual([])
  })

  test('reads a long run of path-like text in time linear in its length', () => {
    // Every `/` could start a path, every `.` could start trailing punctuation: rereading the rest from each one
    // would take seconds.
    const LONG_RUNS = ['-/'.repeat(100_000), `/${'.'.repeat(200_000)}a`, `/${'a.png'.repeat(40_000)}x`, `\`/${'a.png'.repeat(40_000)}`]
    const LINEAR_BUDGET_MS = 200

    for (const run of LONG_RUNS) {
      const started = performance.now()
      imagePathsIn(run)

      expect(performance.now() - started).toBeLessThan(LINEAR_BUDGET_MS)
    }
  })
})

