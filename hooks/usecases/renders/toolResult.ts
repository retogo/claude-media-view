import { toolImageSetting } from '../../domain/settings'
import { toolOutputImages } from '../../domain/toolOutput'
import { loadPicture, readPathOf } from '../images'
import type { Ports } from '../ports'
import { isShown, placeInRows, type PictureRows, type Shown } from './pictureRows'

// The pictures of a call shown on its own `ToolResult` row, a Read's or an MCP tool's, when `showsTool` lets its
// tool through (every tool when absent); null when it has none.
export const toolResult = async (
  ports: Ports,
  {
    toolUseId,
    tool,
    output,
    viewportColumns,
    showsTool = () => true,
  }: { toolUseId: string; tool: string; output: unknown; viewportColumns: number | undefined; showsTool?: (tool: string) => boolean },
): Promise<PictureRows | null> => {
  const images = showsTool(tool) ? toolOutputImages(tool, output) : []
  if (images.length === 0) {
    return null
  }
  const path = tool === 'Read' ? readPathOf(toolUseId) : undefined
  const loading = images.map(async (load, n) => {
    const key = n === 0 ? toolUseId : `${toolUseId}/${n}`
    const picture = await loadPicture(ports, key, async () => load())
    if (picture === null) {
      return null
    }
    await ports.rememberSeen({ key, path, label: path ?? tool, shownAtKey: toolUseId, rowId: toolUseId, setting: toolImageSetting(tool), picture })
    return { key: `image-${n}`, picture }
  })
  const shown: Shown[] = (await Promise.all(loading)).filter(isShown)
  return shown.length === 0 ? null : placeInRows(shown, viewportColumns)
}
