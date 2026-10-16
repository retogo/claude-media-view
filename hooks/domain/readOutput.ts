export type SourceImage = { bytes: Uint8Array }

type ReadOutput = { type?: unknown; file?: { base64?: unknown; type?: unknown } } | null | undefined

// Whether the Read tool's record holds an image, without decoding its base64.
export const isImageReadOutput = (output: unknown) => {
  const read = output as ReadOutput
  return read?.type === 'image' && typeof read.file?.type === 'string'
}

// The bytes of the Read tool's record for an image: `{ type: 'image', file: { base64, type, ... } }`.
export const imageFromReadOutput = (output: unknown): SourceImage | null => {
  if (!isImageReadOutput(output)) {
    return null
  }
  const { base64 } = (output as { file: { base64?: unknown } }).file
  return typeof base64 === 'string' ? { bytes: Uint8Array.fromBase64(base64) } : null
}
