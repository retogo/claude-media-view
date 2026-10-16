// What `$.command.register` declares for `/media-view`.
export const MEDIA_VIEW_COMMAND = {
  name: 'media-view',
  description: 'Open the gallery of this session’s images; `still` or `animate` sets GIFs in the transcript',
  argumentHint: '[still|animate]',
}

export type MediaViewActions = {
  openPane: () => Promise<void>
  setTranscriptAnimated: (isAnimated: boolean) => Promise<void>
}

// `/media-view` opens the media-view pane; `still` and `animate` set transcript GIFs. Answers the command's text.
export const mediaView = async (actions: MediaViewActions, args: string) => {
  const argument = args.trim()
  if (argument === 'still' || argument === 'animate') {
    const isAnimated = argument === 'animate'
    await actions.setTranscriptAnimated(isAnimated)
    return `Transcript GIFs: ${isAnimated ? 'animated' : 'still'}.`
  }
  if (argument !== '') {
    return `Usage: /${MEDIA_VIEW_COMMAND.name} [still|animate]`
  }
  await actions.openPane()
  return 'Opened the media gallery.'
}
