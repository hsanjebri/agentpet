// Visits: your cat walks off your screen and spends a few minutes on a friend's desktop, next to
// their cat. The messages travel on the private Friends channels (only accepted friends can send
// on them). Pure: validation and the rules for when a guest may come in.
import type { SkinId } from './skins'

/** How long a visit lasts. */
export const VISIT_MS = 150_000
/** No answer from the friend's app within this long: "maybe later". */
export const ANSWER_MS = 10_000

export interface Guest {
  visitId: string
  /** the visiting user's id (Friends) */
  from: string
  name: string
  skin: SkinId
  level: number
}

export type VisitMessage =
  | ({ type: 'visit' } & Guest)
  | { type: 'visit_ok'; visitId: string }
  | { type: 'visit_no'; visitId: string; reason: VisitRefusal }
  | { type: 'visit_end'; visitId: string; by: 'host' | 'guest' }

export type VisitRefusal = 'nobody' | 'busy' | 'focus' | 'asleep'

const SKINS: readonly SkinId[] = ['noodle', 'mochi', 'zitouna']

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.length > 0 && v.length <= max ? v : null

/** A broadcast from the network, checked field by field; null if it isn't a valid message. */
export function parseVisitMessage(event: string, payload: unknown): VisitMessage | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>
  const visitId = str(p.visitId, 64)
  if (!visitId) return null
  switch (event) {
    case 'visit': {
      const from = str(p.from, 64)
      const name = str(p.name, 24)
      const skin = SKINS.includes(p.skin as SkinId) ? (p.skin as SkinId) : 'noodle'
      const level =
        typeof p.level === 'number' && p.level >= 1 ? Math.min(100000, Math.floor(p.level)) : 1
      return from && name ? { type: 'visit', visitId, from, name, skin, level } : null
    }
    case 'visit_ok':
      return { type: 'visit_ok', visitId }
    case 'visit_no': {
      const reasons: readonly VisitRefusal[] = ['nobody', 'busy', 'focus', 'asleep']
      const reason = reasons.includes(p.reason as VisitRefusal)
        ? (p.reason as VisitRefusal)
        : 'busy'
      return { type: 'visit_no', visitId, reason }
    }
    case 'visit_end':
      return { type: 'visit_end', visitId, by: p.by === 'host' ? 'host' : 'guest' }
    default:
      return null
  }
}

export interface HostState {
  accepts: 'friends' | 'nobody'
  /** a guest is already here */
  hosting: boolean
  /** this cat is away visiting someone */
  away: boolean
  focusRound: boolean
  bedtime: boolean
  hidden: boolean
  /** the sender is an accepted friend */
  isFriend: boolean
}

/** May a guest come in now? null = yes, else why not (sent back to the visitor). */
export function refusal(s: HostState): VisitRefusal | null {
  if (!s.isFriend || s.accepts === 'nobody') return 'nobody'
  if (s.focusRound) return 'focus'
  if (s.bedtime) return 'asleep'
  if (s.hosting || s.away || s.hidden) return 'busy'
  return null
}

export function refusalText(name: string, reason: VisitRefusal): string {
  switch (reason) {
    case 'focus':
      return `${name} is in a focus session 🍅 Try again later.`
    case 'asleep':
      return `${name} is asleep 😴`
    case 'nobody':
      return `${name} isn't taking visits right now.`
    default:
      return `${name} is busy. Maybe later!`
  }
}
