import { cellBox, type CellBox } from '../../../domain/layout'
import { mediaTypeOf } from '../../../domain/media/decode'
import type { Settings } from '../../../domain/settings'
import { formatShownAt, pasteShownAtKey } from '../../../domain/shownAt'
import type { Picture } from '../../../domain/media/frameCache'
import { joinPath } from '../../../domain/platform'
import { loadImageTag, pasteCacheOf } from '../../images'
import type { Ports } from '../../ports'

export const MEDIA_VIEW_PANE = 'media-view'
const MAX_COLUMNS = 24
const MAX_ROWS = 8

// Rows between entries, and the row each entry's buttons take.
export const ENTRY_GAP = 1
const BUTTON_ROWS = 1
// Between an entry's time and its label.
const HEADING_GAP = '  '
// Room between the panes' content and the engine's tab row above and frame beside: rows on top, columns each side.
export const PANE_PADDING = { top: 1, x: 1 }

// One image of the media-view pane: `label` names it and `heading` puts the time it showed in the chat before
// that, when known; `path` is the file its buttons copy and open, `rowId` is the transcript row to show it in,
// when one drew it, and `isVisible` says whether any of its rows is inside the pane's scroll window.
export type MediaViewEntry = {
  id: string
  label: string
  heading: string
  path: string
  picture: Picture
  box: CellBox
  rowId: string | undefined
  isVisible: boolean
}

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

// The paste cache keeps every paste, also one taken out of the draft before it was sent: only the pastes in the
// draft now, or in a prompt sent from the composer, are the person's (ADR 0025), and of those the ones `isShown`.
const pastedImages = async (ports: Ports, sessionId: string, isShown: (n: number) => boolean) => {
  const pasteCache = await listPasteCache(ports, sessionId)
  if (pasteCache === undefined) {
    return []
  }
  const { host, images, files } = pasteCache
  const numbered = files
    .filter(file => file.kind === 'file' && mediaTypeOf(file.name) !== undefined)
    .map(file => ({ n: Number.parseInt(file.name, 10), path: joinPath(host.os, images, file.name) }))
    .filter(({ n }) => Number.isInteger(n) && isShown(n))
    .sort((a, b) => b.n - a.n)
  return Promise.all(
    numbered.map(async ({ n, path }) => ({
      id: `paste-${n}`,
      timeKey: pasteShownAtKey(n),
      label: path,
      path,
      picture: await loadImageTag(ports, sessionId, n),
      rowId: await ports.imageTagRowOf(n),
    })),
  )
}

// The images rows drew under a setting that is on. An image a tool answered with has no file of its own; its
// picture's first frame in the frame cache stands in.
const toolImages = async (ports: Ports, settings: Settings) =>
  (await ports.seenImages())
    .filter(({ setting }) => settings[setting])
    .reverse()
    .map(({ key, shownAtKey, label, path, picture, rowId }) => ({ id: `read-${key}`, timeKey: shownAtKey, label, path: path ?? picture.frames[0]!.source.file, picture, rowId }))

// Every image the chat shows under the settings that are on (ADR 0026): the draft's pastes first, as they are
// about to show, then newest shown first, and those with no time last, pastes before tools' images, each newest first.
// `shownAt` holds when each image showed in the chat, by tool call id or by `pasteShownAtKey`; `draftNumbers`
// are the draft's image tags.
export const mediaViewPane = async (
  ports: Ports,
  {
    bodyColumns,
    scroll,
    shownAt,
    draftNumbers,
    settings,
  }: { bodyColumns: number; scroll: PaneScroll; shownAt: Readonly<Record<string, number>>; draftNumbers: readonly number[]; settings: Settings },
): Promise<MediaViewEntry[]> => {
  const sessionId = await ports.sessionId()
  const columns = bodyColumns - 2 * PANE_PADDING.x
  const isDrafted = (n: number) => settings.abovePrompt && draftNumbers.includes(n)
  const isSent = (n: number) => settings.sentPastes && pasteShownAtKey(n) in shownAt
  const pastes = await pastedImages(ports, sessionId, n => isDrafted(n) || isSent(n))
  const leading = new Set(draftNumbers.filter(isDrafted).map(pasteShownAtKey))
  const rank = (timeKey: string | undefined) =>
    timeKey === undefined ? Number.NEGATIVE_INFINITY : leading.has(timeKey) ? Number.POSITIVE_INFINITY : (shownAt[timeKey] ?? Number.NEGATIVE_INFINITY)
  const ordered = [...pastes, ...(await toolImages(ports, settings))].sort((a, b) =>
    rank(a.timeKey) === rank(b.timeKey) ? 0 : rank(a.timeKey) > rank(b.timeKey) ? -1 : 1,
  )
  const shown = ordered.flatMap(entry =>
    entry.picture === null
      ? []
      : [{ ...entry, picture: entry.picture, box: cellBox(entry.picture, { maxColumns: Math.min(MAX_COLUMNS, columns), maxRows: MAX_ROWS }) }],
  )
  let top = PANE_PADDING.top
  return shown.map(({ timeKey, ...entry }) => {
    const at = timeKey === undefined ? undefined : shownAt[timeKey]
    const heading = at === undefined ? entry.label : `${formatShownAt(at)}${HEADING_GAP}${entry.label}`
    const rows = Math.ceil(heading.length / columns) + BUTTON_ROWS + entry.box.rows
    const isVisible = top < scroll.offset + scroll.bodyRows && top + rows > scroll.offset
    top += rows + ENTRY_GAP
    return { ...entry, heading, isVisible }
  })
}
