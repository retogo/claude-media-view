import { MEDIA_VIEW_PANE } from '../renders/pane/mediaView'
import { SETTINGS_PANE } from '../renders/pane/settings'

// The gallery and its settings open as a pair of tabs; each closes the other.
const PAIRED: Record<string, string> = { [MEDIA_VIEW_PANE]: SETTINGS_PANE, [SETTINGS_PANE]: MEDIA_VIEW_PANE }

// Closing the gallery stops its GIFs. When the person closes either of the pair, the other closes too; a close
// media-view made itself, or an unload, closes nothing more, so the pair never closes each other in turn. Other
// panes are someone else's.
export const mediaViewClosed = async (
  { paneId, closedBy }: { paneId: string; closedBy: 'plugin' | 'person' | 'unload' },
  actions: { stopPaneAnimations: () => void; closePane: (id: string) => Promise<void> },
) => {
  if (paneId === MEDIA_VIEW_PANE) {
    actions.stopPaneAnimations()
  }
  const other = PAIRED[paneId]
  if (closedBy === 'person' && other !== undefined) {
    await actions.closePane(other)
  }
}
