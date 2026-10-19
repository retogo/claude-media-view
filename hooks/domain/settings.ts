// Where media-view shows images, each named after the Claude Code component it draws in, and how it plays GIFs
// (ADR 0027), each the person's to turn off in the settings pane.
export const SHOW_SETTING_KEYS = ['abovePrompt', 'userMessages', 'toolCalls', 'assistantMessages'] as const
export const PLAY_SETTING_KEYS = ['animateGifs'] as const
export const SETTING_KEYS = [...SHOW_SETTING_KEYS, ...PLAY_SETTING_KEYS] as const

export type SettingKey = (typeof SETTING_KEYS)[number]

export type Settings = Record<SettingKey, boolean>

// The settings that each let images be shown in one place, in the chat and in the gallery alike.
export type ShowSetting = (typeof SHOW_SETTING_KEYS)[number]

// The settings pane's sections, in the order the person reads them.
export const SETTING_SECTIONS: readonly { title: string; keys: readonly SettingKey[] }[] = [
  { title: 'Show media', keys: SHOW_SETTING_KEYS },
  { title: 'GIFs', keys: PLAY_SETTING_KEYS },
]

export const SETTING_LABELS: Record<SettingKey, string> = {
  abovePrompt: 'Above the prompt',
  userMessages: 'Under prompts you sent',
  toolCalls: 'Under Claude’s tool calls',
  assistantMessages: 'Under Claude’s replies',
  animateGifs: 'Animate GIFs',
}

export const DEFAULT_SETTINGS: Settings = {
  abovePrompt: true,
  userMessages: true,
  toolCalls: true,
  assistantMessages: true,
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
