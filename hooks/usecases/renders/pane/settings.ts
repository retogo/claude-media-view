import { SETTING_KEYS, SETTING_LABELS, type SettingKey, type Settings } from '../../../domain/settings'

export const SETTINGS_PANE = 'media-view-settings'

// One line of the settings pane: what media-view draws, and whether it does.
export type SettingEntry = { key: SettingKey; label: string; isOn: boolean }

// The settings pane's lines, in the order the person reads them.
export const settingsPane = (settings: Settings): SettingEntry[] =>
  SETTING_KEYS.map(key => ({ key, label: SETTING_LABELS[key], isOn: settings[key] }))
