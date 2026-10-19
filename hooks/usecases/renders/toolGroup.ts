import { toolOutputImages } from '../../domain/toolOutput'
import { loadPicture, readPathOf, rememberSeen } from '../images'
import type { Ports } from '../ports'
import { isShown, placeInRows, type PictureRows, type Shown } from './pictureRows'

export type ToolGroupCall = { tool_use_id?: string; tool: string; input: unknown; output?: unknown }

// The pictures of the calls folded into one `ToolGroup` row, a Read's or an MCP tool's; null when it has none.
export const toolGroup = async (
  ports: Ports,
  { requestId, calls, viewportColumns }: { requestId: string; calls: readonly ToolGroupCall[]; viewportColumns: number | undefined },
): Promise<PictureRows | null> => {
  const images = calls.flatMap((call, i) => toolOutputImages(call.tool, call.output).map((load, n) => ({ call, i, n, load })))
  if (images.length === 0) {
    return null
  }
  const sessionId = await ports.sessionId()
  const loading = images.map(({ call, i, n, load }) => {
    const callKey = call.tool_use_id ?? `${requestId}/${i}`
    const key = n === 0 ? callKey : `${callKey}/${n}`
    // The base64 is decoded only when the picture is not cached yet.
    const picture = loadPicture(ports, key, async () => load())
    const inputPath = (call.input as { file_path?: unknown } | undefined)?.file_path
    const path = call.tool !== 'Read' ? undefined : typeof inputPath === 'string' ? inputPath : readPathOf(key)
    rememberSeen({ key, path, label: path ?? call.tool, callId: call.tool_use_id, picture, sessionId, rowId: requestId })
    return picture.then(loaded => loaded && { key: `image-${i}-${n}`, picture: loaded })
  })
  const shown: Shown[] = (await Promise.all(loading)).filter(isShown)
  return shown.length === 0 ? null : placeInRows(shown, viewportColumns)
}
