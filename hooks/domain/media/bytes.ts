export const concat = (parts: readonly Uint8Array[]) => {
  const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  parts.reduce((offset, part) => (joined.set(part, offset), offset + part.length), 0)
  return joined
}
