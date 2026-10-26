// Everything the user can change in Settings, its defaults, and the validation every change goes
// through (changes come from a renderer, so they are untrusted). Pure, shared by both sides.
import { SKINS, type SkinId } from './skins'

export type PetSize = 's' | 'm' | 'l'
/** developer = follows Claude Code; fun = music, Pomodoro and company, no Claude anywhere */
export type UserMode = 'developer' | 'fun'
export type SoundName = 'meow' | 'toot' | 'purr' | 'tick'
export type RiskKind =
  'secrets' | 'rm_rf' | 'force_push' | 'drop_table' | 'chmod_777' | 'deleted_tests' | 'many_files'
export type Visits = 'friends' | 'nobody'

export const PET_SIZES: readonly PetSize[] = ['s', 'm', 'l']
/** Screen pixels per sprite cell. */
export const SIZE_SCALE: Record<PetSize, number> = { s: 3, m: 4, l: 5 }
export const SOUND_NAMES: readonly SoundName[] = ['meow', 'toot', 'purr', 'tick']
export const RISK_KINDS: readonly RiskKind[] = [
  'secrets',
  'rm_rf',
  'force_push',
  'drop_table',
  'chmod_777',
  'deleted_tests',
  'many_files'
]
export const RISK_LABELS: Record<RiskKind, string> = {
  secrets: '.env & secrets',
  rm_rf: 'rm -rf',
  force_push: 'git push --force',
  drop_table: 'DROP TABLE',
  chmod_777: 'chmod 777',
  deleted_tests: 'deleted tests',
  many_files: 'many files in one turn'
}

export interface SoundSettings {
  /** 0–1 */
  volume: number
  meow: boolean
  toot: boolean
  purr: boolean
  /** Pomodoro ticking; off by default */
  tick: boolean
}

export interface AutoHideSettings {
  /** a fullscreen app (video, game, slides) */
  fullscreen: boolean
  /** a meeting or screen share (microphone in use) */
  meetings: boolean
  /** the OS's Do not disturb / Focus assist */
  dnd: boolean
}

export interface PomodoroSettings {
  focusMin: number
  breakMin: number
  longBreakMin: number
  /** a long break after this many focus rounds */
  rounds: number
}

/** What is saved on disk (settings.json). */
export interface StoredSettings {
  skin: SkinId
  size: PetSize
  mode: UserMode
  muted: boolean
  focusMode: boolean
  wander: boolean
  music: boolean
  feeding: boolean
  rareMoments: boolean
  greetings: boolean
  sounds: SoundSettings
  autoHide: AutoHideSettings
  usageBar: boolean
  /** off = Noodle only alerts; the user answers in the terminal */
  approvalBubble: boolean
  risks: Record<RiskKind, boolean>
  /** paths / commands (substrings) that never make him hiss */
  riskAllow: string[]
  pomodoro: PomodoroSettings
  autoUpdate: boolean
  friends: boolean
  visits: Visits
}

/** The settings the renderer sees: the stored ones plus a few facts about this computer. */
export interface PetSettings extends StoredSettings {
  /** the music feature exists on this OS (Windows only for now) */
  musicSupported: boolean
  /** auto-hide can read the OS state here (Windows only for now) */
  autoHideSupported: boolean
  /** cycling through every mood (tray › Mood demo); not saved */
  demo: boolean
  /** starts with the computer (installed app only) */
  startOnLogin: boolean
  /** false in dev: registering a dev build would start a bare Electron at login */
  startOnLoginSupported: boolean
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] }

/** A change from a Settings screen: any stored setting (nested ones partly), or start on login. */
export type SettingsChange = DeepPartial<StoredSettings> & { startOnLogin?: boolean }

export function defaultSettings(): StoredSettings {
  return {
    skin: 'noodle',
    size: 'm',
    mode: 'developer',
    muted: false,
    focusMode: false,
    wander: true,
    music: true,
    feeding: true,
    rareMoments: true,
    greetings: true,
    sounds: { volume: 0.8, meow: true, toot: true, purr: true, tick: false },
    autoHide: { fullscreen: true, meetings: true, dnd: true },
    usageBar: true,
    approvalBubble: true,
    risks: Object.fromEntries(RISK_KINDS.map((k) => [k, true])) as Record<RiskKind, boolean>,
    riskAllow: [],
    pomodoro: { focusMin: 25, breakMin: 5, longBreakMin: 15, rounds: 4 },
    autoUpdate: true,
    friends: false,
    visits: 'friends'
  }
}

const BOOLEAN_KEYS = [
  'muted',
  'focusMode',
  'wander',
  'music',
  'feeding',
  'rareMoments',
  'greetings',
  'usageBar',
  'approvalBubble',
  'autoUpdate',
  'friends'
] as const

const POMODORO_LIMITS: Record<keyof PomodoroSettings, [number, number]> = {
  focusMin: [1, 120],
  breakMin: [1, 60],
  longBreakMin: [1, 90],
  rounds: [1, 12]
}

const MAX_ALLOW = 50
const MAX_ALLOW_TEXT = 200

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Keeps only the valid parts of a change; unknown keys and bad values are dropped. */
export function cleanChange(input: unknown): SettingsChange {
  if (!isObject(input)) return {}
  const out: SettingsChange = {}
  for (const key of BOOLEAN_KEYS) if (typeof input[key] === 'boolean') out[key] = input[key]
  if (typeof input.startOnLogin === 'boolean') out.startOnLogin = input.startOnLogin
  if (SKINS.some((s) => s.ready && s.id === input.skin)) out.skin = input.skin as SkinId
  if (PET_SIZES.includes(input.size as PetSize)) out.size = input.size as PetSize
  if (input.mode === 'developer' || input.mode === 'fun') out.mode = input.mode
  if (input.visits === 'friends' || input.visits === 'nobody') out.visits = input.visits

  if (isObject(input.sounds)) {
    const sounds: Partial<SoundSettings> = {}
    const v = input.sounds.volume
    if (typeof v === 'number' && Number.isFinite(v)) sounds.volume = Math.min(1, Math.max(0, v))
    for (const name of SOUND_NAMES)
      if (typeof input.sounds[name] === 'boolean') sounds[name] = input.sounds[name] as boolean
    out.sounds = sounds
  }
  if (isObject(input.autoHide)) {
    const autoHide: Partial<AutoHideSettings> = {}
    for (const key of ['fullscreen', 'meetings', 'dnd'] as const)
      if (typeof input.autoHide[key] === 'boolean') autoHide[key] = input.autoHide[key] as boolean
    out.autoHide = autoHide
  }
  if (isObject(input.risks)) {
    const risks: Partial<Record<RiskKind, boolean>> = {}
    for (const kind of RISK_KINDS)
      if (typeof input.risks[kind] === 'boolean') risks[kind] = input.risks[kind] as boolean
    out.risks = risks
  }
  if (Array.isArray(input.riskAllow)) {
    out.riskAllow = input.riskAllow
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim().slice(0, MAX_ALLOW_TEXT))
      .filter(Boolean)
      .slice(0, MAX_ALLOW)
  }
  if (isObject(input.pomodoro)) {
    const pomodoro: Partial<PomodoroSettings> = {}
    for (const [key, [min, max]] of Object.entries(POMODORO_LIMITS) as Array<
      [keyof PomodoroSettings, [number, number]]
    >) {
      const n = input.pomodoro[key]
      if (typeof n === 'number' && Number.isFinite(n))
        pomodoro[key] = Math.min(max, Math.max(min, Math.round(n)))
    }
    out.pomodoro = pomodoro
  }
  return out
}

/** The stored settings after a (clean) change; nested settings are merged, not replaced. */
export function applyChange(current: StoredSettings, change: SettingsChange): StoredSettings {
  const { sounds, autoHide, risks, pomodoro, ...flat } = change
  delete flat.startOnLogin // not stored: the OS keeps it
  return {
    ...current,
    ...flat,
    sounds: { ...current.sounds, ...sounds },
    autoHide: { ...current.autoHide, ...autoHide },
    risks: { ...current.risks, ...risks },
    pomodoro: { ...current.pomodoro, ...pomodoro }
  } as StoredSettings
}

/** Fills in whatever an older settings file lacks, so existing users keep every value. */
export function withDefaults(stored: unknown): StoredSettings {
  return applyChange(defaultSettings(), cleanChange(stored))
}
