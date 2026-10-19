import type { EngineInterface, RenderElement, RenderInputOf } from 'claude-code'

import type { CellBox } from '../domain/layout'
import type { SettingKey } from '../domain/settings'
import { TILE_GAP, type AbovePromptTiles } from '../usecases/renders/abovePrompt'
import { ENTRY_GAP, PANE_PADDING, type MediaViewEntry } from '../usecases/renders/pane/mediaView'
import type { SettingSection } from '../usecases/renders/pane/settings'
import { PICTURE_GAP, type PictureRows } from '../usecases/renders/pictureRows'
import { animate, reportDeny, stopAnimation, stopAnimations, stopAnimationsExcept, type Site } from './animator'

const BUTTON_GAP = 1
// Rows between the settings pane's sections.
const SECTION_GAP = 1

// An Image of another size is another Image: the terminal keeps an unchanged source at the size it was first sent (ADR 0017).
const sizedKey = (key: string, { columns, rows }: CellBox) => `${key}@${columns}x${rows}`

type TranscriptRow = RenderInputOf<'ToolGroup' | 'ToolResult' | 'UserMessage' | 'AssistantMessage', 'terminal'>

// The engine's own row, then the pictures under it; GIFs move only while the row is on screen (ADR 0008).
export function drawPictureRows(
  $: EngineInterface,
  e: TranscriptRow,
  { site, own, rows, isAnimated }: { site: Site; own: RenderElement; rows: PictureRows; isAnimated: boolean },
) {
  const { Box, Image } = $.ui.resolve(e)
  const pictures = rows.flat().map(shown => ({ ...shown, key: sizedKey(shown.key, shown.box) }))
  if (e.props.onScreen === null || !isAnimated) {
    stopAnimations(site, e.requestId)
  } else {
    stopAnimationsExcept(site, e.requestId, pictures.map(({ key }) => key))
    pictures.forEach(({ key, picture }) => animate($, { site, requestId: e.requestId, key, frames: picture.frames }, deny => reportDeny($, deny)))
  }

  return (
    <Box flexDirection="column">
      {own}
      {rows.map(row => (
        <Box flexDirection="row" gap={PICTURE_GAP}>
          {row.map(({ key, picture, box }) => (
            <Image key={sizedKey(key, box)} source={picture.frames[0]!.source} columns={box.columns} rows={box.rows} alt="image" />
          ))}
        </Box>
      ))}
    </Box>
  )
}

// The draft's pictures above the prompt, each labelled `#n`, with `+N` for those left out.
export function drawAbovePrompt($: EngineInterface, e: RenderInputOf<'AbovePrompt', 'terminal'>, { tiles, hidden }: AbovePromptTiles) {
  const { Box, Image, Text } = $.ui.resolve(e)
  const keys = tiles.map(({ n, box }) => sizedKey(`paste-${n}`, box))
  stopAnimationsExcept('AbovePrompt', e.requestId, keys)
  tiles.forEach(({ picture }, i) =>
    animate($, { site: 'AbovePrompt', requestId: e.requestId, key: keys[i]!, frames: picture.frames }, deny => reportDeny($, deny)),
  )

  return (
    <Box flexDirection="row" gap={TILE_GAP}>
      {tiles.map(({ n, picture, box }) => (
        <Box flexDirection="column">
          <Image key={sizedKey(`paste-${n}`, box)} source={picture.frames[0]!.source} columns={box.columns} rows={box.rows} alt={`[Image #${n}]`} />
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
    return (
      <Box paddingTop={PANE_PADDING.top} paddingX={PANE_PADDING.x}>
        <Text dimColor>No images in this session yet.</Text>
      </Box>
    )
  }
  // Only entries inside the pane's scroll window move (ADR 0008).
  const keys = entries.map(({ id, box }) => sizedKey(id, box))
  stopAnimationsExcept('Pane', e.requestId, keys)
  entries.forEach(({ picture, isVisible }, i) =>
    isVisible
      ? animate($, { site: 'Pane', requestId: e.requestId, key: keys[i]!, frames: picture.frames }, deny => reportDeny($, deny))
      : stopAnimation('Pane', e.requestId, keys[i]!),
  )

  return (
    <Box flexDirection="column" gap={ENTRY_GAP} paddingTop={PANE_PADDING.top} paddingX={PANE_PADDING.x}>
      {entries.map(({ id, label, heading, path, picture, box, rowId }) => (
        <Box flexDirection="column">
          <Text>{heading}</Text>
          <Box flexDirection="row" gap={BUTTON_GAP}>
            <Button key={`copy-${id}`} label="Copy path" onPress={() => buttons.copyPath(path)} />
            <Button key={`open-${id}`} label="Open" onPress={() => buttons.open(path)} />
            {rowId !== undefined && <Button key={`show-${id}`} label="Show in chat" onPress={() => buttons.showInChat(rowId)} />}
          </Box>
          <Image key={sizedKey(id, box)} source={picture.frames[0]!.source} columns={box.columns} rows={box.rows} alt={label} />
        </Box>
      ))}
    </Box>
  )
}

// What media-view draws, each a button that turns it on or off, under its section's title.
export function drawSettingsPane($: EngineInterface, e: RenderInputOf<'Pane', 'terminal'>, sections: SettingSection[], toggle: (key: SettingKey) => unknown) {
  const { Box, Button, Text } = $.ui.resolve(e)
  return (
    <Box flexDirection="column" gap={SECTION_GAP} paddingTop={PANE_PADDING.top} paddingX={PANE_PADDING.x}>
      <Text dimColor>What media-view draws, kept for every session:</Text>
      {sections.map(({ title, entries }) => (
        <Box flexDirection="column">
          <Text bold>{title}</Text>
          {entries.map(({ key, label, isOn }) => (
            <Button key={`setting-${key}`} label={`[${isOn ? 'x' : ' '}] ${label}`} onPress={() => toggle(key)} />
          ))}
        </Box>
      ))}
    </Box>
  )
}
