import { SETTING_LABELS, SETTING_SECTIONS, type SettingKey, type Settings } from '../../../domain/settings'

export const SETTINGS_PANE = 'media-view-settings'

// One line of the settings pane: what media-view draws, and whether it does.
export type SettingEntry = { key: SettingKey; label: string; isOn: boolean }

// A titled group of the settings pane's lines.
export type SettingSection = { title: string; entries: SettingEntry[] }

// The settings pane's sections, in the order the person reads them.
export const settingsPane = (settings: Settings): SettingSection[] =>
  SETTING_SECTIONS.map(({ title, keys }) => ({ title, entries: keys.map(key => ({ key, label: SETTING_LABELS[key], isOn: settings[key] })) }))
