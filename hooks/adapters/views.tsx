import type { EngineInterface, RenderElement, RenderInputOf } from 'claude-code'

import { TILE_GAP, type AbovePromptTiles } from '../usecases/renders/abovePrompt'
import { ENTRY_GAP, type MediaViewEntry } from '../usecases/renders/pane/mediaView'
import { PICTURE_GAP, type PictureRows } from '../usecases/renders/pictureRows'
import { animate, reportDeny, stopAnimation, stopAnimations, type Site } from './animator'

const BUTTON_GAP = 1

type TranscriptRow = RenderInputOf<'ToolGroup' | 'ToolResult' | 'UserMessage', 'terminal'>

// The engine's own row, then the pictures under it; GIFs move only while the row is on screen (ADR 0008).
export function drawPictureRows(
  $: EngineInterface,
  e: TranscriptRow,
  { site, own, rows, isAnimated }: { site: Site; own: RenderElement; rows: PictureRows; isAnimated: boolean },
) {
  const { Box, Image } = $.ui.resolve(e)
  if (e.props.onScreen === null || !isAnimated) {
    stopAnimations(site, e.requestId)
  } else {
    rows.flat().forEach(({ key, picture }) => animate($, { site, requestId: e.requestId, key, frames: picture.frames }, deny => reportDeny($, deny)))
  }

  return (
    <Box flexDirection="column">
      {own}
      {rows.map(row => (
        <Box flexDirection="row" gap={PICTURE_GAP}>
          {row.map(({ key, picture, box }) => (
            <Image key={key} source={picture.frames[0]!.source} columns={box.columns} rows={box.rows} alt="image" />
          ))}
        </Box>
      ))}
    </Box>
  )
}

// The draft's pictures above the prompt, each labelled `#n`, with `+N` for those left out.
export function drawAbovePrompt($: EngineInterface, e: RenderInputOf<'AbovePrompt', 'terminal'>, { tiles, hidden }: AbovePromptTiles) {
  const { Box, Image, Text } = $.ui.resolve(e)
  tiles.forEach(({ n, picture }) =>
    animate($, { site: 'AbovePrompt', requestId: e.requestId, key: `paste-${n}`, frames: picture.frames }, deny => reportDeny($, deny)),
  )

  return (
    <Box flexDirection="row" gap={TILE_GAP}>
      {tiles.map(({ n, picture, box }) => (
        <Box flexDirection="column">
          <Image key={`paste-${n}`} source={picture.frames[0]!.source} columns={box.columns} rows={box.rows} alt={`[Image #${n}]`} />
          <Text dimColor>{`#${n}`}</Text>
        </Box>
      ))}
      {hidden > 0 && <Text dimColor>{`+${hidden}`}</Text>}
    </Box>
  )
}

export type MediaViewButtons = {
  copyPath: (path: string) => unknown
  open: (path: string) => unknown
  showInChat: (rowId: string) => unknown
}

// Each image of the session: its path and buttons above its picture, so text lines up whatever the width.
export function drawMediaViewPane($: EngineInterface, e: RenderInputOf<'Pane', 'terminal'>, entries: MediaViewEntry[], buttons: MediaViewButtons) {
  const { Box, Button, Image, Text } = $.ui.resolve(e)
  if (entries.length === 0) {
    return <Text dimColor>No images in this session yet.</Text>
  }
  // Only entries inside the pane's scroll window move (ADR 0008).
  entries.forEach(({ id, picture, isVisible }) =>
    isVisible
      ? animate($, { site: 'Pane', requestId: e.requestId, key: id, frames: picture.frames }, deny => reportDeny($, deny))
      : stopAnimation('Pane', e.requestId, id),
  )

  return (
    <Box flexDirection="column" gap={ENTRY_GAP}>
      {entries.map(({ id, path, picture, box, rowId }) => (
        <Box flexDirection="column">
          <Text>{path}</Text>
          <Box flexDirection="row" gap={BUTTON_GAP}>
            <Button key={`copy-${id}`} label="Copy path" onPress={() => buttons.copyPath(path)} />
            <Button key={`open-${id}`} label="Open" onPress={() => buttons.open(path)} />
            {rowId !== undefined && <Button key={`show-${id}`} label="Show in chat" onPress={() => buttons.showInChat(rowId)} />}
          </Box>
          <Image key={id} source={picture.frames[0]!.source} columns={box.columns} rows={box.rows} alt={path} />
        </Box>
      ))}
    </Box>
  )
}
