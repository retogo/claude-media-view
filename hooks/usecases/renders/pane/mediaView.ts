import { cellBox, type CellBox } from '../../../domain/layout'
import { mediaTypeOf } from '../../../domain/media/decode'
import type { Picture } from '../../../domain/media/frameCache'
import { joinPath } from '../../../domain/platform'
import { imageTagRowOf, loadImageTag, pasteCacheOf, seenImages } from '../../images'
import type { Ports } from '../../ports'

export const MEDIA_VIEW_PANE = 'media-view'
const MAX_COLUMNS = 24
const MAX_ROWS = 8

// Rows between entries, and the row each entry's buttons take.
export const ENTRY_GAP = 1
const BUTTON_ROWS = 1

// One image of the media-view pane: `rowId` is the transcript row to show it in, when one drew it;
// `isVisible` says whether any of its rows is inside the pane's scroll window.
export type MediaViewEntry = { id: string; path: string; picture: Picture; box: CellBox; rowId: string | undefined; isVisible: boolean }

export type PaneScroll = { offset: number; bodyRows: number }

// The paste cache, when the tmp root can be listed; a gallery without it still lists Read images.
const listPasteCache = async (ports: Ports, sessionId: string) => {
  const host = await ports.host()
  try {
    const images = await pasteCacheOf(ports, host, sessionId)
    return images === undefined ? undefined : { host, images, files: await ports.listDirectory(images) }
  } catch {
    return undefined
  }
}

const pastedImages = async (ports: Ports, sessionId: string) => {
  const pasteCache = await listPasteCache(ports, sessionId)
  if (pasteCache === undefined) {
    return []
  }
  const { host, images, files } = pasteCache
  const numbered = files
    .filter(file => file.kind === 'file' && mediaTypeOf(file.name) !== undefined)
    .map(file => ({ n: Number.parseInt(file.name, 10), path: joinPath(host.os, images, file.name) }))
    .filter(({ n }) => Number.isInteger(n))
    .sort((a, b) => b.n - a.n)
  return Promise.all(
    numbered.map(async ({ n, path }) => ({
      id: `paste-${n}`,
      path,
      picture: await loadImageTag(ports, sessionId, n),
      rowId: imageTagRowOf(sessionId, n),
    })),
  )
}

const readImages = (sessionId: string) =>
  Promise.all(
    seenImages(sessionId)
      .reverse()
      .map(async ({ key, path, picture, rowId }) => ({ id: `read-${key}`, path, picture: await picture, rowId })),
  )

// Every image of the session: pasted ones newest first, then the ones Read results drew, newest first.
export const mediaViewPane = async (
  ports: Ports,
  { bodyColumns, scroll }: { bodyColumns: number; scroll: PaneScroll },
): Promise<MediaViewEntry[]> => {
  const sessionId = await ports.sessionId()
  const shown = [...(await pastedImages(ports, sessionId)), ...(await readImages(sessionId))].flatMap(entry =>
    entry.picture === null
      ? []
      : [{ ...entry, picture: entry.picture, box: cellBox(entry.picture, { maxColumns: Math.min(MAX_COLUMNS, bodyColumns), maxRows: MAX_ROWS }) }],
  )
  let top = 0
  return shown.map(entry => {
    const rows = Math.ceil(entry.path.length / bodyColumns) + BUTTON_ROWS + entry.box.rows
    const isVisible = top < scroll.offset + scroll.bodyRows && top + rows > scroll.offset
    top += rows + ENTRY_GAP
    return { ...entry, isVisible }
  })
}
