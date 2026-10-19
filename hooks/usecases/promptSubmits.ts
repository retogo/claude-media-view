import { imageTagNumbers } from '../domain/imageTags'
import { pasteShownAtKey } from '../domain/shownAt'

// A sent prompt's pasted images show in the chat now, each kept under its image tag.
export const promptSubmits = async (recordShown: (key: string) => Promise<void>, text: string) => {
  for (const n of imageTagNumbers(text)) {
    await recordShown(pasteShownAtKey(n))
  }
}
