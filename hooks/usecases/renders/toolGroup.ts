import { imageFromReadOutput, isImageReadOutput } from '../../domain/readOutput'
import { loadPicture, readPathOf, rememberSeen } from '../images'
import type { Ports } from '../ports'
import { isShown, placeInRows, type PictureRows, type Shown } from './pictureRows'

export type ToolGroupCall = { tool_use_id?: string; tool: string; input: unknown; output?: unknown }

// The pictures of the Read calls folded into one `ToolGroup` row; null when it has none.
export const toolGroup = async (
  ports: Ports,
  { requestId, calls, viewportColumns }: { requestId: string; calls: readonly ToolGroupCall[]; viewportColumns: number | undefined },
): Promise<PictureRows | null> => {
  const images = calls.flatMap((call, i) => (call.tool === 'Read' && isImageReadOutput(call.output) ? [{ call, i }] : []))
  if (images.length === 0) {
    return null
  }
  const sessionId = await ports.sessionId()
  const loading = images.map(({ call, i }) => {
    const key = call.tool_use_id ?? `${requestId}/${i}`
    // The base64 is decoded only when the picture is not cached yet.
    const picture = loadPicture(ports, key, async () => imageFromReadOutput(call.output))
    const inputPath = (call.input as { file_path?: unknown } | undefined)?.file_path
    const path = typeof inputPath === 'string' ? inputPath : readPathOf(key)
    if (path !== undefined) {
      rememberSeen({ key, path, picture, sessionId, rowId: requestId })
    }
    return picture.then(loaded => loaded && { key: `read-${i}`, picture: loaded })
  })
  const shown: Shown[] = (await Promise.all(loading)).filter(isShown)
  return shown.length === 0 ? null : placeInRows(shown, viewportColumns)
}
