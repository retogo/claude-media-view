// What media-view draws, each the person's to turn off in the settings pane, in the order the pane lists them.
export const SETTING_KEYS = ['abovePrompt', 'sentPastes', 'readImages', 'toolImages', 'replyPaths', 'animateGifs'] as const

export type SettingKey = (typeof SETTING_KEYS)[number]

export type Settings = Record<SettingKey, boolean>

export const SETTING_LABELS: Record<SettingKey, string> = {
  abovePrompt: 'Pasted images above the prompt',
  sentPastes: 'Pasted images in sent prompts',
  readImages: 'Images Claude reads',
  toolImages: 'Images tools answer with',
  replyPaths: 'Image files named in replies',
  animateGifs: 'Animate GIFs',
}

export const DEFAULT_SETTINGS: Settings = {
  abovePrompt: true,
  sentPastes: true,
  readImages: true,
  toolImages: true,
  replyPaths: true,
  animateGifs: true,
}

// Settings from what the plugin's store holds, a file the person or an older version may have written: a setting
// missing or not a yes or no stays at its default.
export const settingsFrom = (stored: unknown): Settings => {
  const values = (stored ?? {}) as Partial<Record<SettingKey, unknown>>
  return Object.fromEntries(
    SETTING_KEYS.map(key => [key, typeof values[key] === 'boolean' ? values[key] : DEFAULT_SETTINGS[key]]),
  ) as Settings
}

export const toggled = (settings: Settings, key: SettingKey): Settings => ({ ...settings, [key]: !settings[key] })
