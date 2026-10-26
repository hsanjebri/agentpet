// Auto-hide: what the OS says (fullscreen app, microphone in use, Do not disturb) and whether the
// pet should step aside for it. Pure; the main process reads the OS state.
import type { AutoHideSettings } from './settings'

export interface OsState {
  /** a fullscreen app, game or presentation is in front */
  fullscreen: boolean
  /** an app is using the microphone (a call or meeting) */
  mic: boolean
  /** Do not disturb / Focus assist is on */
  dnd: boolean
}

export type HideReason = 'fullscreen' | 'meeting' | 'dnd'

export const VISIBLE: OsState = { fullscreen: false, mic: false, dnd: false }

/** One line from the watcher, e.g. {"fullscreen":true,"mic":false,"dnd":false}; null if garbage. */
export function parseOsLine(line: string): OsState | null {
  try {
    const raw = JSON.parse(line) as Record<string, unknown>
    if (typeof raw !== 'object' || raw === null) return null
    return { fullscreen: raw.fullscreen === true, mic: raw.mic === true, dnd: raw.dnd === true }
  } catch {
    return null
  }
}

/** Why he should hide now (only for the switches that are on), or null. */
export function hideReason(os: OsState, settings: AutoHideSettings): HideReason | null {
  if (settings.meetings && os.mic) return 'meeting'
  if (settings.fullscreen && os.fullscreen) return 'fullscreen'
  if (settings.dnd && os.dnd) return 'dnd'
  return null
}

export function anyAutoHide(settings: AutoHideSettings): boolean {
  return settings.fullscreen || settings.meetings || settings.dnd
}
