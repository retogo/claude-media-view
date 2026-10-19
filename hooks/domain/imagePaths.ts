// An absolute local path starts at one separator or at a drive and one separator; Windows reads `/` and `\` alike.
// Two separators (`//host`, `/\host`, `\\host`) name a network share or a device, which merely reaching can hand
// a host the person's credentials; they never match, nor does a drive followed by two.
const ABSOLUTE_LOCAL_START = String.raw`(?:[A-Za-z]:[\\/](?![\\/])|\/(?![\\/]))`
// A path in backticks, taken whole, spaces included: an absolute path ending in a format this module decodes.
const QUOTED = new RegExp(`\`(${ABSOLUTE_LOCAL_START}[^\`]*?\\.(?:png|gif|jpe?g))\``, 'gi')
// Prose splits into words at spaces, quotes and brackets; each word is tested on its own, so the text is read once.
const WORD = /[^\s`'"()<>[\]]+/g
// A word that is a whole absolute path to such a file: not a URL (`https://`) nor a relative path (`./`, `docs/`).
const ABSOLUTE_IMAGE_PATH = new RegExp(`^${ABSOLUTE_LOCAL_START}.*\\.(?:png|gif|jpe?g)$`, 'i')
// Punctuation that ends a sentence or a list after a path, not part of it.
const TRAILING_PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?'])

// A word less the punctuation it ends with, walked back from its end: a pattern anchored at the end would retry
// from every mark of a long run of them.
const withoutTrailingPunctuation = (word: string) => {
  let end = word.length
  while (end > 0 && TRAILING_PUNCTUATION.has(word[end - 1]!)) {
    end--
  }
  return word.slice(0, end)
}

// The absolute paths of PNG, GIF and JPEG files a text names, each once, in the order they first appear. The text
// is the model's, so it is read in time linear in its length (ADR 0022).
export const imagePathsIn = (text: string) => {
  const quoted = [...text.matchAll(QUOTED)].map(match => ({ index: match.index, path: match[1]! }))
  const bare = [...text.matchAll(WORD)]
    .map(match => ({ index: match.index, path: withoutTrailingPunctuation(match[0]) }))
    .filter(({ path }) => ABSOLUTE_IMAGE_PATH.test(path))
  const found = [...quoted, ...bare].sort((a, b) => a.index - b.index).map(({ path }) => path)
  return [...new Set(found)]
}
