import { imagePathsIn } from '../../domain/imagePaths'
import { loadPicture } from '../images'
import type { Ports } from '../ports'
import { isShown, placeInRows, type PictureRows, type Shown } from './pictureRows'

// The picture of an image file a reply names, when Read may read it without asking and the file is there: a reply
// is drawn again and again, so it never puts a question to the person nor retries a path to nothing (ADR 0022).
const replyImage = async (ports: Ports, requestId: string, path: string, i: number): Promise<Shown | null> => {
  if ((await ports.checkRead(path)).decision !== 'allow' || !(await ports.exists(path))) {
    return null
  }
  const key = `file/${path}`
  const picture = await loadPicture(ports, key, async () => ({ bytes: await ports.readFile(path) }))
  if (picture === null) {
    return null
  }
  await ports.rememberSeen({ key, path, label: path, shownAtKey: requestId, rowId: requestId, setting: 'replyPaths', picture })
  await ports.rememberShownAt(requestId)
  return { key: `image-${i}`, picture }
}

// The pictures of the image files an `AssistantMessage` row names; null when it names none that can be drawn.
export const assistantMessage = async (
  ports: Ports,
  { requestId, text, viewportColumns }: { requestId: string; text: string; viewportColumns: number | undefined },
): Promise<PictureRows | null> => {
  const paths = imagePathsIn(text)
  if (paths.length === 0) {
    return null
  }
  const shown = (await Promise.all(paths.map((path, i) => replyImage(ports, requestId, path, i)))).filter(isShown)
  return shown.length === 0 ? null : placeInRows(shown, viewportColumns)
}
