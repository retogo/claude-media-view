import { imageTagNumbers } from '../../domain/imageTags'
import { loadImageTag } from '../images'
import type { Ports } from '../ports'
import { isShown, placeInRows, type PictureRows, type Shown } from './pictureRows'

// The pictures of the `[Image #n]` tags in a sent prompt's `UserMessage` row; null when it has none.
export const userMessage = async (
  ports: Ports,
  {
    requestId,
    text,
    isFromSomeoneElse,
    viewportColumns,
  }: { requestId: string; text: string; isFromSomeoneElse: boolean; viewportColumns: number | undefined },
): Promise<PictureRows | null> => {
  // Another agent, teammate or session numbers its own pastes; its tags are not this session's.
  const numbers = isFromSomeoneElse ? [] : imageTagNumbers(text)
  if (numbers.length === 0) {
    return null
  }
  const sessionId = await ports.sessionId()
  await Promise.all(numbers.map(n => ports.rememberImageTagRow(n, requestId)))
  const shown: Shown[] = (
    await Promise.all(numbers.map(n => loadImageTag(ports, sessionId, n).then(picture => picture && { key: `paste-${n}`, picture })))
  ).filter(isShown)
  return shown.length === 0 ? null : placeInRows(shown, viewportColumns)
}
