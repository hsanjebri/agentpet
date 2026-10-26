import { describe, expect, it } from 'vitest'
import { IDLE, type PomodoroState, command, leftMs, tick, timeLeft } from '@shared/pomodoro'

const S = { focusMin: 25, breakMin: 5, longBreakMin: 15, rounds: 2 }
const MIN = 60_000
const T0 = 1_000_000

function start(): PomodoroState {
  return command(IDLE, 'start', S, T0).state
}

describe('Pomodoro', () => {
  it('focus -> break -> focus, with a long break after N rounds', () => {
    let s = start()
    expect(s).toMatchObject({ phase: 'focus', round: 1 })

    let r = tick(s, S, T0 + 25 * MIN)
    expect(r.events).toEqual(['focus_done'])
    s = r.state
    expect(s).toMatchObject({ phase: 'break', today: 1 })

    s = tick(s, S, T0 + 30 * MIN).state
    expect(s).toMatchObject({ phase: 'focus', round: 2 })

    r = tick(s, S, T0 + 55 * MIN)
    expect(r.state.phase).toBe('long_break') // round 2 of 2
    expect(r.state.today).toBe(2)
  })

  it('nothing happens before the time is up', () => {
    const s = start()
    expect(tick(s, S, T0 + 24 * MIN).state).toBe(s)
  })

  it('pause keeps the time left; resume picks it up', () => {
    let s = start()
    s = command(s, 'pause', S, T0 + 5 * MIN).state
    expect(leftMs(s, T0 + 60 * MIN)).toBe(20 * MIN) // frozen while paused
    expect(tick(s, S, T0 + 60 * MIN).events).toEqual([])
    s = command(s, 'resume', S, T0 + 60 * MIN).state
    expect(leftMs(s, T0 + 60 * MIN)).toBe(20 * MIN)
    expect(timeLeft(s, T0 + 60 * MIN)).toBe('20:00')
  })

  it('skipping focus earns nothing; stop keeps today’s count', () => {
    let s = start()
    const skipped = command(s, 'skip', S, T0 + MIN)
    expect(skipped.events).toEqual([])
    expect(skipped.state).toMatchObject({ phase: 'break', today: 0 })

    s = tick(start(), S, T0 + 25 * MIN).state
    const stopped = command(s, 'stop', S, T0 + 26 * MIN).state
    expect(stopped).toMatchObject({ phase: null, today: 1 })
  })
})
