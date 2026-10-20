import { MEDIA_VIEW_COMMAND } from './commandRuns/mediaView'

export type SessionStartActions = {
  watchDraft: () => void
  registerCommand: (command: typeof MEDIA_VIEW_COMMAND) => Promise<void>
}

// What a session needs once it binds: the draft watch for the AbovePrompt band, and /media-view.
export const sessionStarts = async (actions: SessionStartActions) => {
  actions.watchDraft()
  await actions.registerCommand(MEDIA_VIEW_COMMAND)
}
