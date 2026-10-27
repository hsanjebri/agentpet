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

/** Where you are: for the weather and prayer times. Typed by you, never detected. */
export interface Place {
  city: string
  lat: number
  lon: number
}

export const PRAYER_METHODS = [
  'MuslimWorldLeague',
  'Egyptian',
  'Karachi',
  'UmmAlQura',
  'Dubai',
  'Qatar',
  'Kuwait',
  'Turkey',
  'Tehran',
  'Singapore',
  'NorthAmerica',
  'MoonsightingCommittee'
] as const
export type PrayerMethod = (typeof PRAYER_METHODS)[number]

export interface WaterSettings {
  enabled: boolean
  everyMin: number
}

export interface GuardSettings {
  /** during a Pomodoro focus round, sit on distracting windows */
  enabled: boolean
  /** words in a window title that count as a distraction */
  sites: string[]
}

export interface StretchSettings {
  enabled: boolean
  everyMin: number
}

export interface BedtimeSettings {
  enabled: boolean
  /** "23:00", local time */
  at: string
}

/** "Bac in 23 days 📚": he holds the number on a sign. */
export interface Countdown {
  label: string
  /** "2027-06-10" */
  date: string
}

export interface PrayerSettings {
  enabled: boolean
  method: PrayerMethod
  /** iftar countdown and a lantern during Ramadan */
  ramadan: boolean
}

export const DEFAULT_GUARD_SITES = [
  'YouTube',
  'Instagram',
  'TikTok',
  'Facebook',
  'Netflix',
  'Reddit',
  'Twitch',
  'Snapchat'
]

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
  water: WaterSettings
  guard: GuardSettings
  /** weather outfits (sends only the place's coordinates to Open-Meteo) */
  weather: boolean
  prayer: PrayerSettings
  place: Place | null
  /** Ctrl+Alt+L: a red dot he chases */
  laser: boolean
  stretch: StretchSettings
  bedtime: BedtimeSettings
  countdown: Countdown | null
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
    visits: 'friends',
    water: { enabled: true, everyMin: 60 },
    guard: { enabled: true, sites: [...DEFAULT_GUARD_SITES] },
    weather: false,
    prayer: { enabled: false, method: 'MuslimWorldLeague', ramadan: true },
    place: null,
    laser: true,
    stretch: { enabled: true, everyMin: 90 },
    bedtime: { enabled: false, at: '23:30' },
    countdown: null
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
  'friends',
  'weather',
  'laser'
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
  if (isObject(input.water)) {
    const water: Partial<WaterSettings> = {}
    if (typeof input.water.enabled === 'boolean') water.enabled = input.water.enabled
    const n = input.water.everyMin
    if (typeof n === 'number' && Number.isFinite(n))
      water.everyMin = Math.min(240, Math.max(15, Math.round(n)))
    out.water = water
  }
  if (isObject(input.guard)) {
    const guard: Partial<GuardSettings> = {}
    if (typeof input.guard.enabled === 'boolean') guard.enabled = input.guard.enabled
    if (Array.isArray(input.guard.sites))
      guard.sites = input.guard.sites
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 30)
    out.guard = guard
  }
  if (isObject(input.prayer)) {
    const prayer: Partial<PrayerSettings> = {}
    if (typeof input.prayer.enabled === 'boolean') prayer.enabled = input.prayer.enabled
    if (typeof input.prayer.ramadan === 'boolean') prayer.ramadan = input.prayer.ramadan
    if (PRAYER_METHODS.includes(input.prayer.method as PrayerMethod))
      prayer.method = input.prayer.method as PrayerMethod
    out.prayer = prayer
  }
  if (isObject(input.stretch)) {
    const stretch: Partial<StretchSettings> = {}
    if (typeof input.stretch.enabled === 'boolean') stretch.enabled = input.stretch.enabled
    const n = input.stretch.everyMin
    if (typeof n === 'number' && Number.isFinite(n))
      stretch.everyMin = Math.min(240, Math.max(30, Math.round(n)))
    out.stretch = stretch
  }
  if (isObject(input.bedtime)) {
    const bedtime: Partial<BedtimeSettings> = {}
    if (typeof input.bedtime.enabled === 'boolean') bedtime.enabled = input.bedtime.enabled
    if (typeof input.bedtime.at === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.bedtime.at))
      bedtime.at = input.bedtime.at
    out.bedtime = bedtime
  }
  if (input.countdown === null) out.countdown = null
  else if (isObject(input.countdown)) {
    const { label, date } = input.countdown
    if (
      typeof label === 'string' &&
      label.trim() &&
      typeof date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(Date.parse(date))
    )
      out.countdown = { label: label.trim().slice(0, 24), date }
  }
  if (input.place === null) out.place = null
  else if (isObject(input.place)) {
    const { city, lat, lon } = input.place
    if (
      typeof city === 'string' &&
      typeof lat === 'number' &&
      typeof lon === 'number' &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180
    )
      out.place = { city: city.trim().slice(0, 80), lat, lon }
  }
  return out
}

/** The stored settings after a (clean) change; nested settings are merged, not replaced. */
export function applyChange(current: StoredSettings, change: SettingsChange): StoredSettings {
  const { sounds, autoHide, risks, pomodoro, water, guard, prayer, stretch, bedtime, ...flat } =
    change
  delete flat.startOnLogin // not stored: the OS keeps it
  return {
    ...current,
    ...flat,
    sounds: { ...current.sounds, ...sounds },
    autoHide: { ...current.autoHide, ...autoHide },
    risks: { ...current.risks, ...risks },
    pomodoro: { ...current.pomodoro, ...pomodoro },
    water: { ...current.water, ...water },
    guard: { ...current.guard, ...guard },
    prayer: { ...current.prayer, ...prayer },
    stretch: { ...current.stretch, ...stretch },
    bedtime: { ...current.bedtime, ...bedtime }
  } as StoredSettings
}

/** Fills in whatever an older settings file lacks, so existing users keep every value. */
export function withDefaults(stored: unknown): StoredSettings {
  return applyChange(defaultSettings(), cleanChange(stored))
}
