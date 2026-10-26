// Music: what the nowplaying helper reports, and the rules for how the pet reacts.
// Pure functions only (main runs the helper, renderer shows the pet).

export interface MusicState {
  hasSession: boolean
  playing: boolean
  title?: string
  artist?: string
  app?: string // "Spotify", "Chrome"...
  thumb?: string // small base64 PNG, only on the line where the track changed
}

export type MusicCommand = 'toggle' | 'next' | 'prev'
export const MUSIC_COMMANDS: readonly MusicCommand[] = ['toggle', 'next', 'prev']

export const NO_MUSIC: MusicState = { hasSession: false, playing: false }

const MAX_TEXT = 200
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value.slice(0, MAX_TEXT) : undefined

/** One line from the helper -> a clean state, or null if it isn't valid JSON. */
export function parseMusicLine(line: string): MusicState | null {
  let raw: unknown
  try {
    raw = JSON.parse(line)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (r.hasSession !== true) return NO_MUSIC
  const thumb = typeof r.thumb === 'string' && r.thumb.length < 200_000 ? r.thumb : undefined
  return {
    hasSession: true,
    playing: r.playing === true,
    title: text(r.title),
    artist: text(r.artist),
    app: text(r.app),
    thumb
  }
}

/** Splits a stream of chunks into whole lines (a chunk can end in the middle of one). */
export class LineBuffer {
  private rest = ''

  push(chunk: string): string[] {
    const lines = (this.rest + chunk).split(/\r?\n/)
    this.rest = lines.pop() ?? ''
    return lines.filter((l) => l.trim() !== '')
  }
}

/** Wait before restarting the helper after its n-th crash (0-based); null = give up. */
export const RESTART_DELAYS_MS = [1000, 2000, 5000, 10_000, 30_000]
export function restartDelay(attempt: number): number | null {
  return attempt < RESTART_DELAYS_MS.length ? RESTART_DELAYS_MS[attempt] : null
}

/** Same song? (Used to count songs and to announce track changes.) */
export function trackKey(m: MusicState): string | null {
  return m.hasSession && m.title ? `${m.app ?? ''}\n${m.title}\n${m.artist ?? ''}` : null
}

/** A new song started playing: count it (once per track). */
export function isNewSong(previous: MusicState | null, next: MusicState): boolean {
  const key = trackKey(next)
  return next.playing && key !== null && key !== (previous ? trackKey(previous) : null)
}

/** Headphones come off after this long paused or without any music app. */
export const HEADPHONES_OFF_AFTER_MS = 30_000

export interface MusicView {
  headphones: boolean
  /** head bob + tail tapping */
  grooving: boolean
}

/**
 * How the pet shows the music. `quietSince` is when playback last stopped (paused or no
 * session), or null while playing.
 */
export function musicView(
  music: MusicState | null,
  quietSince: number | null,
  now: number
): MusicView {
  if (music?.playing) return { headphones: true, grooving: true }
  const recently = quietSince !== null && now - quietSince < HEADPHONES_OFF_AFTER_MS
  return { headphones: recently, grooving: false }
}

/** "🎵 Title – Artist", shortened to fit a bubble. */
export function songLine(m: MusicState, max = 42): string {
  const full = [m.title, m.artist].filter(Boolean).join(' – ')
  return full.length > max ? full.slice(0, max - 1) + '…' : full
}
