import { MEDIA_VIEW_COMMAND } from './commandRuns/mediaView'
import { FRAMES_TOOL } from './toolCalls/frames'

export type SessionStartActions = {
  watchDraft: () => void
  registerTool: (tool: typeof FRAMES_TOOL) => Promise<void>
  registerCommand: (command: typeof MEDIA_VIEW_COMMAND) => Promise<void>
}

// What a session needs once it binds: the draft watch for the AbovePrompt band, the frames tool and /media-view.
export const sessionStarts = async (actions: SessionStartActions) => {
  actions.watchDraft()
  await actions.registerTool(FRAMES_TOOL)
  await actions.registerCommand(MEDIA_VIEW_COMMAND)
}
