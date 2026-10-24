// Pure mood logic: (state, input, now) -> new state. No timers or React in here.
//
// The pet has a base mood (sleeping / working), an optional short-lived mood (happy, sad,
// hiss, sweat) and a "needs you" flag that beats everything until the user responds.
import type { PetEvent } from '@shared/events'
import type { Mood } from './moods'

export type TempMood = 'happy' | 'sad' | 'hiss' | 'sweat'

export interface MoodState {
  base: 'sleeping' | 'working'
  needs: boolean
  temp: { mood: TempMood; until: number } | null
  lastActivity: number
}

export type MoodInput =
  | { type: 'event'; event: PetEvent }
  | { type: 'sweat' } // usage crossed a warning threshold
  | { type: 'pet_clicked' }
  | { type: 'tick' } // a timer fired; lets timeouts expire

/** Back to sleep after this long without agent activity. */
export const IDLE_MS = 2 * 60_000

export const TEMP_MS: Record<TempMood, number> = {
  happy: 5000,
  sad: 5000,
  hiss: 4000,
  sweat: 4000
}

/** When moods collide, the higher one wins. */
export const PRIORITY: Record<Mood, number> = {
  needs: 6,
  hiss: 5,
  sad: 4,
  happy: 3,
  sweat: 2,
  working: 1,
  sleeping: 0
}

export function initialMoodState(now: number): MoodState {
  return { base: 'sleeping', needs: false, temp: null, lastActivity: now }
}

/** Drops whatever has timed out by `now`. */
function settle(state: MoodState, now: number): MoodState {
  let next = state
  if (next.temp && now >= next.temp.until) next = { ...next, temp: null }
  if (next.base === 'working' && now - next.lastActivity >= IDLE_MS) {
    next = { ...next, base: 'sleeping' }
  }
  return next
}

/** Shows a short-lived mood unless a more important one is already showing. */
function flash(state: MoodState, mood: TempMood, now: number): MoodState {
  if (state.temp && PRIORITY[state.temp.mood] > PRIORITY[mood]) return state
  return { ...state, temp: { mood, until: now + TEMP_MS[mood] } }
}

function onEvent(state: MoodState, event: PetEvent, now: number): MoodState {
  const active = { ...state, lastActivity: now }
  switch (event.type) {
    case 'working':
    case 'tool':
    case 'tool_done':
      // the agent carries on, so whatever it was waiting for has been answered;
      // a "done!" celebration also ends when new work starts
      return {
        ...active,
        base: 'working',
        needs: false,
        temp: active.temp?.mood === 'happy' ? null : active.temp
      }
    case 'needs_you':
      return { ...active, needs: true }
    case 'done':
      return flash({ ...active, base: 'sleeping', needs: false }, 'happy', now)
    case 'error':
      return flash(active, 'sad', now)
    case 'risky':
      return flash(active, 'hiss', now)
    case 'session_end':
      return { ...active, base: 'sleeping', needs: false }
    case 'session_start':
      return active
  }
}

export function nextMoodState(state: MoodState, input: MoodInput, now: number): MoodState {
  const settled = settle(state, now)
  switch (input.type) {
    case 'tick':
      return settled
    case 'pet_clicked':
      return { ...settled, needs: false }
    case 'sweat':
      return flash(settled, 'sweat', now)
    case 'event':
      return onEvent(settled, input.event, now)
  }
}

export function currentMood(state: MoodState, now: number): Mood {
  const settled = settle(state, now)
  if (settled.needs) return 'needs'
  return settled.temp?.mood ?? settled.base
}

/** The next time the mood changes on its own (a timeout), or null if nothing is pending. */
export function nextChangeAt(state: MoodState): number | null {
  const times: number[] = []
  if (state.temp) times.push(state.temp.until)
  if (state.base === 'working') times.push(state.lastActivity + IDLE_MS)
  return times.length ? Math.min(...times) : null
}
