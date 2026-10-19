declare module 'claude-code' {
  interface PluginState {
    'media-view': {
      isTranscriptAnimated: boolean
      draftImageNumbers: number[]
      mediaViewScrollOffset: number
      // When each image showed in the chat, ms since the epoch: by tool call id, or `paste-<n>` for a sent paste.
      shownAt: Record<string, number>
    }
  }

  interface McpToolInputs {
    'mcp__media-view__frames': { path: string; maxFrames?: number }
  }
}
