const ALT_PREFIX = 'the Image draws its alt here: '
const PLACEHOLDER_REASON = /^the terminal draws no placeholder images \((.+)\)$/
const LOCAL_FILES_REASON = /^this terminal cannot read files on this machine \((.+)\)$/
const FORCE_SETTING = '"CLAUDE_CODE_FORCE_TERMINAL_IMAGES": "1" to the env block of ~/.claude/settings.json'

// A refusal that holds for this terminal, as opposed to an Image not mounted yet.
export const isTerminalDeny = (deny: string) => deny.startsWith(ALT_PREFIX)

// The fix for a blit refused because this terminal draws the Image's alt (ADR 0001).
export const noticeFor = (deny: string): string | undefined => {
  if (!deny.startsWith(ALT_PREFIX)) {
    return undefined
  }
  const reason = deny.slice(ALT_PREFIX.length)
  const placeholder = PLACEHOLDER_REASON.exec(reason)?.[1]
  if (placeholder === 'bg worker') {
    return `media-view: background sessions draw no pictures. Add ${FORCE_SETTING}; it applies at once.`
  }
  if (placeholder === 'inside tmux or screen') {
    return `media-view: tmux and screen draw no pictures by default. Run \`tmux set -g allow-passthrough on\` and add ${FORCE_SETTING}.`
  }
  const localFiles = LOCAL_FILES_REASON.exec(reason)?.[1]
  if (localFiles !== undefined) {
    return `media-view: this terminal cannot read files on this machine (${localFiles}), so pictures cannot be shown.`
  }
  return `media-view: this terminal shows no pictures (${placeholder ?? reason}). Pictures need the kitty graphics protocol with Unicode placeholders: Ghostty or kitty.`
}

