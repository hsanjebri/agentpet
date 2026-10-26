// The Pomodoro timer as pure functions: focus -> break -> focus …, a long break after N rounds.
// The main process owns the state and ticks it; the pet window and Settings only show it.
import type { PomodoroSettings } from './settings'

export type PomodoroPhase = 'focus' | 'break' | 'long_break'
export type PomodoroCommand = 'start' | 'pause' | 'resume' | 'skip' | 'stop'
export const POMODORO_COMMANDS: readonly PomodoroCommand[] = [
  'start',
  'pause',
  'resume',
  'skip',
  'stop'
]

export interface PomodoroState {
  /** null = not running */
  phase: PomodoroPhase | null
  /** the focus round in progress (or just done, during a break), from 1 */
  round: number
  /** when the phase ends (ignored while paused) */
  endsAt: number
  /** time left when paused, null while running */
  pausedLeftMs: number | null
  /** focus rounds finished today (for the hover bubble and Settings) */
  today: number
}

/** What happened during a tick or command, for rewards and sounds. */
export type PomodoroEvent = 'focus_done' | 'break_done'

export const IDLE: PomodoroState = {
  phase: null,
  round: 0,
  endsAt: 0,
  pausedLeftMs: null,
  today: 0
}

const MIN = 60_000

function lengthOf(phase: PomodoroPhase, s: PomodoroSettings): number {
  const minutes = phase === 'focus' ? s.focusMin : phase === 'break' ? s.breakMin : s.longBreakMin
  return minutes * MIN
}

function enter(
  state: PomodoroState,
  phase: PomodoroPhase,
  round: number,
  s: PomodoroSettings,
  now: number
): PomodoroState {
  return { ...state, phase, round, endsAt: now + lengthOf(phase, s), pausedLeftMs: null }
}

/** The phase after this one: a break after focus (long every N rounds), focus after a break. */
function advance(state: PomodoroState, s: PomodoroSettings, now: number): PomodoroState {
  if (state.phase === 'focus') {
    const long = state.round % s.rounds === 0
    return enter(state, long ? 'long_break' : 'break', state.round, s, now)
  }
  return enter(state, 'focus', state.round + 1, s, now)
}

export function command(
  state: PomodoroState,
  cmd: PomodoroCommand,
  s: PomodoroSettings,
  now: number
): { state: PomodoroState; events: PomodoroEvent[] } {
  switch (cmd) {
    case 'start':
      return { state: enter(state, 'focus', 1, s, now), events: [] }
    case 'stop':
      return { state: { ...IDLE, today: state.today }, events: [] }
    case 'pause':
      if (!state.phase || state.pausedLeftMs !== null) return { state, events: [] }
      return { state: { ...state, pausedLeftMs: Math.max(0, state.endsAt - now) }, events: [] }
    case 'resume':
      if (!state.phase || state.pausedLeftMs === null) return { state, events: [] }
      return {
        state: { ...state, endsAt: now + state.pausedLeftMs, pausedLeftMs: null },
        events: []
      }
    case 'skip':
      // skipping focus earns nothing; skipping a break just starts the next round
      if (!state.phase) return { state, events: [] }
      return { state: advance(state, s, now), events: [] }
  }
}

/** Moves on when the current phase is over. */
export function tick(
  state: PomodoroState,
  s: PomodoroSettings,
  now: number
): { state: PomodoroState; events: PomodoroEvent[] } {
  if (!state.phase || state.pausedLeftMs !== null || now < state.endsAt)
    return { state, events: [] }
  const event: PomodoroEvent = state.phase === 'focus' ? 'focus_done' : 'break_done'
  const next = advance(state, s, now)
  return {
    state: event === 'focus_done' ? { ...next, today: next.today + 1 } : next,
    events: [event]
  }
}

export function leftMs(state: PomodoroState, now: number): number {
  if (!state.phase) return 0
  return state.pausedLeftMs ?? Math.max(0, state.endsAt - now)
}

/** "18:42" */
export function timeLeft(state: PomodoroState, now: number): string {
  const total = Math.ceil(leftMs(state, now) / 1000)
  const m = Math.floor(total / 60)
  const sec = total % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function phaseLabel(state: PomodoroState): string {
  if (state.phase === 'focus') return `🍅 Focus ${state.round}`
  if (state.phase === 'long_break') return '🍵 Long break'
  if (state.phase === 'break') return '🍵 Break'
  return 'Pomodoro'
}
