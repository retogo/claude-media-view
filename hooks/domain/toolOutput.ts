import { imageFromReadOutput, isImageReadOutput, type SourceImage } from './readOutput'

// One image of a tool's output; its base64 is decoded only when called.
export type ImageLoad = () => SourceImage | null

type ContentBlock = { type?: unknown; source?: { type?: unknown; data?: unknown } } | null | undefined

const base64Data = (block: ContentBlock) =>
  block?.type === 'image' && block.source?.type === 'base64' && typeof block.source.data === 'string' ? block.source.data : undefined

// The images a tool's output carries: a Read's own record, or the base64 image blocks of a result made of API
// content blocks, as MCP tools such as a browser's screenshot answer (ADR 0018).
export const toolOutputImages = (tool: string, output: unknown): ImageLoad[] => {
  if (tool === 'Read') {
    return isImageReadOutput(output) ? [() => imageFromReadOutput(output)] : []
  }
  if (!Array.isArray(output)) {
    return []
  }
  return output.flatMap((block: ContentBlock) => {
    const data = base64Data(block)
    return data === undefined ? [] : [() => ({ bytes: Uint8Array.fromBase64(data) })]
  })
}
