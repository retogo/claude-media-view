import { MEDIA_VIEW_PANE } from '../renders/pane/mediaView'

// Closing the media-view pane stops its GIFs; other panes are someone else's.
export const mediaViewClosed = (paneId: string, actions: { stopPaneAnimations: () => void }) => {
  if (paneId === MEDIA_VIEW_PANE) {
    actions.stopPaneAnimations()
  }
}
