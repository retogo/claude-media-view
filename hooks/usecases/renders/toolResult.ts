import { toolOutputImages } from '../../domain/toolOutput'
import { loadPicture, readPathOf, rememberSeen } from '../images'
import type { Ports } from '../ports'
import { isShown, placeInRows, type PictureRows, type Shown } from './pictureRows'

// The pictures of a call shown on its own `ToolResult` row, a Read's or an MCP tool's; null when it has none.
export const toolResult = async (
  ports: Ports,
  { toolUseId, tool, output, viewportColumns }: { toolUseId: string; tool: string; output: unknown; viewportColumns: number | undefined },
): Promise<PictureRows | null> => {
  const images = toolOutputImages(tool, output)
  if (images.length === 0) {
    return null
  }
  const sessionId = await ports.sessionId()
  const path = tool === 'Read' ? readPathOf(toolUseId) : undefined
  const pictures = images.map((load, n) => {
    const key = n === 0 ? toolUseId : `${toolUseId}/${n}`
    const picture = loadPicture(ports, key, async () => load())
    rememberSeen({ key, path, label: path ?? tool, picture, sessionId, rowId: toolUseId })
    return picture
  })
  const shown: Shown[] = (await Promise.all(pictures.map((picture, n) => picture.then(loaded => loaded && { key: `image-${n}`, picture: loaded })))).filter(isShown)
  return shown.length === 0 ? null : placeInRows(shown, viewportColumns)
}
