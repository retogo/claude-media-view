declare module 'claude-code' {
  interface PluginState {
    'media-view': { isTranscriptAnimated: boolean; draftImageNumbers: number[]; mediaViewScrollOffset: number }
  }

  interface McpToolInputs {
    'mcp__media-view__frames': { path: string; maxFrames?: number }
  }
}
