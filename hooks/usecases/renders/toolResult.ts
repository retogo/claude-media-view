import { imageFromReadOutput, isImageReadOutput } from '../../domain/readOutput'
import { loadPicture, readPathOf, rememberSeen } from '../images'
import type { Ports } from '../ports'
import { placeInRows, type PictureRows } from './pictureRows'

// The picture of a Read shown on its own `ToolResult` row; null for any other result.
export const toolResult = async (
  ports: Ports,
  { toolUseId, tool, output, viewportColumns }: { toolUseId: string; tool: string; output: unknown; viewportColumns: number | undefined },
): Promise<PictureRows | null> => {
  if (tool !== 'Read' || !isImageReadOutput(output)) {
    return null
  }
  const picture = loadPicture(ports, toolUseId, async () => imageFromReadOutput(output))
  const path = readPathOf(toolUseId)
  if (path !== undefined) {
    rememberSeen({ key: toolUseId, path, picture, sessionId: await ports.sessionId(), rowId: toolUseId })
  }
  const loaded = await picture
  return loaded ? placeInRows([{ key: 'read', picture: loaded }], viewportColumns) : null
}
