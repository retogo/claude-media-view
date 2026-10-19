// What `$.command.register` declares for `/media-view`.
export const MEDIA_VIEW_COMMAND = {
  name: 'media-view',
  description: 'Open the gallery of this session’s images; `settings` chooses what is drawn; `still` or `animate` sets GIFs',
  argumentHint: '[settings|still|animate]',
}

export type MediaViewActions = {
  openPane: () => Promise<void>
  openSettings: () => Promise<void>
  // Brings the open gallery to the front of the engine's tabs.
  showPane: () => Promise<void>
  setTranscriptAnimated: (isAnimated: boolean) => Promise<void>
}

// `/media-view` opens the gallery and `settings` the settings, each with the other as the engine's tab beside it,
// so the settings are always one tab away. Tabs stand in the order first opened, the gallery first, and a pane
// first opened is shown, so the gallery is shown again after the settings open. `still` and `animate` set GIFs.
// Answers the command's text.
export const mediaView = async (actions: MediaViewActions, args: string) => {
  const argument = args.trim()
  if (argument === 'still' || argument === 'animate') {
    const isAnimated = argument === 'animate'
    await actions.setTranscriptAnimated(isAnimated)
    return `Transcript GIFs: ${isAnimated ? 'animated' : 'still'}.`
  }
  if (argument === 'settings') {
    await actions.openPane()
    await actions.openSettings()
    return 'Opened the media-view settings.'
  }
  if (argument !== '') {
    return `Usage: /${MEDIA_VIEW_COMMAND.name} ${MEDIA_VIEW_COMMAND.argumentHint}`
  }
  await actions.openPane()
  await actions.openSettings()
  await actions.showPane()
  return 'Opened the media gallery.'
}
