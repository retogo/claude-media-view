import { toolOutputImages } from '../../domain/toolOutput'

// After any tool call: when its result carries images, they show in the chat now, kept under the call's id.
export const anyTool = async (
  recordShown: (key: string) => Promise<void>,
  { tool, toolUseId, result }: { tool: string; toolUseId: string; result: unknown },
) => {
  if (toolOutputImages(tool, result).length > 0) {
    await recordShown(toolUseId)
  }
}
