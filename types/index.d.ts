export type MediaViewSeenImage = {
  key: string
  path?: string
  label: string
  shownAtKey?: string
  rowId: string
  setting: 'abovePrompt' | 'userMessages' | 'toolCalls' | 'assistantMessages'
  picture: { width: number; height: number; frames: { source: { file: string; format: 'png' }; delayMs: number }[] }
}

declare module 'claude-code' {
  interface PluginState {
    'media-view': {
      // What media-view draws, loaded from the plugin's store at session start.
      settings: {
        abovePrompt: boolean
        userMessages: boolean
        toolCalls: boolean
        assistantMessages: boolean
        animateGifs: boolean
        convertFormats: boolean
        preferFfmpeg: boolean
      }
      draftImageNumbers: number[]
      mediaViewScrollOffset: number
      // When each image showed in the chat, ms since the epoch: by tool call id, or `paste-<n>` for a sent paste.
      shownAt: Record<string, number>
      // The images the transcript drew from tools' results, oldest first, and the row that drew each sent image tag.
      seenImages: MediaViewSeenImage[]
      imageTagRows: Record<string, string>
    }
  }
}
