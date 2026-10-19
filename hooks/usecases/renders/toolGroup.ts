import { toolOutputImages } from '../../domain/toolOutput'
import { loadPicture, readPathOf } from '../images'
import type { Ports } from '../ports'
import { isShown, placeInRows, type PictureRows, type Shown } from './pictureRows'

export type ToolGroupCall = { tool_use_id?: string; tool: string; input: unknown; output?: unknown }

// The pictures of the calls folded into one `ToolGroup` row, a Read's or an MCP tool's; null when it has none.
export const toolGroup = async (
  ports: Ports,
  {
    requestId,
    calls,
    viewportColumns,
  }: { requestId: string; calls: readonly ToolGroupCall[]; viewportColumns: number | undefined },
): Promise<PictureRows | null> => {
  const images = calls.flatMap((call, i) => toolOutputImages(call.tool, call.output).map((load, n) => ({ call, i, n, load })))
  if (images.length === 0) {
    return null
  }
  const loading = images.map(async ({ call, i, n, load }) => {
    const callKey = call.tool_use_id ?? `${requestId}/${i}`
    const key = n === 0 ? callKey : `${callKey}/${n}`
    // The base64 is decoded only when the picture is not cached yet.
    const picture = await loadPicture(ports, key, async () => load())
    if (picture === null) {
      return null
    }
    const inputPath = (call.input as { file_path?: unknown } | undefined)?.file_path
    const path = call.tool !== 'Read' ? undefined : typeof inputPath === 'string' ? inputPath : readPathOf(key)
    await ports.rememberSeen({ key, path, label: path ?? call.tool, shownAtKey: call.tool_use_id, rowId: requestId, setting: 'toolCalls', picture })
    return { key: `image-${i}-${n}`, picture }
  })
  const shown: Shown[] = (await Promise.all(loading)).filter(isShown)
  return shown.length === 0 ? null : placeInRows(shown, viewportColumns)
}
