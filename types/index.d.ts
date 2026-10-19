export type MediaViewSeenImage = {
  key: string
  path?: string
  label: string
  callId?: string
  rowId: string
  picture: { width: number; height: number; frames: { source: { file: string; format: 'png' }; delayMs: number }[] }
}

declare module 'claude-code' {
  interface PluginState {
    'media-view': {
      isTranscriptAnimated: boolean
      draftImageNumbers: number[]
      mediaViewScrollOffset: number
      // When each image showed in the chat, ms since the epoch: by tool call id, or `paste-<n>` for a sent paste.
      shownAt: Record<string, number>
      // The images the transcript drew from tools' results, oldest first, and the row that drew each sent image tag.
      seenImages: MediaViewSeenImage[]
      imageTagRows: Record<string, string>
    }
  }

  interface McpToolInputs {
    'mcp__media-view__frames': { path: string; maxFrames?: number }
  }
}
