// Friends: what the Friends screen shows and the small pure rules around friend codes.
// The network part lives in the main process (Supabase), and only while Friends is on.
import type { SkinId } from './skins'

export type FriendsStatus =
  /** Friends is switched off: nothing is loaded, nothing is sent */
  | 'off'
  /** this build has no Supabase project configured */
  | 'unconfigured'
  | 'connecting'
  | 'online'
  /** no network, or the server is down: nothing else breaks */
  | 'offline'

export interface FriendPet {
  /** the friendship row */
  id: number
  userId: string
  name: string
  skin: SkinId
  level: number
  code: string
  online: boolean
}

export interface FriendsView {
  status: FriendsStatus
  myCode?: string
  friends: FriendPet[]
  /** requests waiting for your answer */
  incoming: FriendPet[]
  /** requests you sent */
  outgoing: FriendPet[]
  /** people you blocked */
  blocked: FriendPet[]
}

export const FRIENDS_OFF: FriendsView = {
  status: 'off',
  friends: [],
  incoming: [],
  outgoing: [],
  blocked: []
}

export type RespondAction = 'accept' | 'decline' | 'cancel' | 'remove' | 'block' | 'unblock'
export const RESPOND_ACTIONS: readonly RespondAction[] = [
  'accept',
  'decline',
  'cancel',
  'remove',
  'block',
  'unblock'
]

export type FriendsCommand =
  | { type: 'add'; code: string }
  | { type: 'respond'; id: number; action: RespondAction }
  | { type: 'retry' }

export interface FriendsResult {
  ok: boolean
  message?: string
}

// the pet's name + 4 random characters without look-alikes (no 0/O/1/I): read out loud and
// typed by hand
const CODE = /^[A-Z]{2,6}-[A-HJ-NP-Z2-9]{4}$/

/** "noodle 48k2", "Noodle-48K2 " -> "NOODLE-48K2"; null if it can't be a friend code. */
export function normalizeCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const match = /^([A-Z]{2,6})([A-Z0-9]{4})$/.exec(compact)
  if (!match) return null
  const code = `${match[1]}-${match[2]}`
  return CODE.test(code) ? code : null
}

/** What send_friend_request answered, for people. */
export function addResultMessage(answer: string): FriendsResult {
  switch (answer) {
    case 'sent':
      return { ok: true, message: 'Request sent! It shows up once they accept.' }
    case 'accepted':
      return { ok: true, message: 'They had asked you already: you’re friends now 🎉' }
    case 'already':
      return { ok: true, message: 'Already friends (or already asked).' }
    case 'self':
      return { ok: false, message: 'That’s your own code 😺' }
    case 'limit':
      return { ok: false, message: 'That’s 20 requests today: try again tomorrow.' }
    default:
      return { ok: false, message: 'No pet with that code.' }
  }
}

/** Rows from friends_overview() sorted into the screen's lists. */
export function viewFromRows(
  rows: ReadonlyArray<Record<string, unknown>>,
  online: ReadonlySet<string>
): Pick<FriendsView, 'friends' | 'incoming' | 'outgoing' | 'blocked'> {
  const view = { friends: [], incoming: [], outgoing: [], blocked: [] } as Pick<
    FriendsView,
    'friends' | 'incoming' | 'outgoing' | 'blocked'
  >
  for (const r of rows) {
    const pet: FriendPet = {
      id: Number(r.id),
      userId: String(r.user_id),
      name: String(r.pet_name ?? '?'),
      skin: (r.skin as SkinId) ?? 'noodle',
      level: Number(r.level ?? 1),
      code: String(r.friend_code ?? ''),
      online: online.has(String(r.user_id))
    }
    if (r.kind === 'friend') view.friends.push(pet)
    else if (r.kind === 'incoming') view.incoming.push(pet)
    else if (r.kind === 'outgoing') view.outgoing.push(pet)
    else if (r.kind === 'blocked') view.blocked.push(pet)
  }
  return view
}
