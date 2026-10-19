const DATE_PART_DIGITS = 2
// Date's months count from 0.
const FIRST_MONTH = 1

const pad = (value: number) => String(value).padStart(DATE_PART_DIGITS, '0')

// When an image showed in the chat, as local `YYYY-MM-DD HH:MM` (ADR 0020).
export const formatShownAt = (epochMs: number) => {
  const at = new Date(epochMs)
  return `${at.getFullYear()}-${pad(at.getMonth() + FIRST_MONTH)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`
}

// The key a sent paste's time is kept under; a tool's image is kept under its call's id.
export const pasteShownAtKey = (n: number) => `paste-${n}`
