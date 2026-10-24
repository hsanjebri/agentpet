import { describe, expect, it } from 'vitest'
import { crossedWarning, meterLevel, usageMeter } from '../src/renderer/src/usage'

describe('usageMeter', () => {
  it('prefers the 5-hour session limit', () => {
    expect(usageMeter({ sessionPct: 23.6, contextPct: 40, timestamp: 0 })).toMatchObject({
      label: 'session',
      pct: 23.6
    })
  })

  it('falls back to the context window, with the cost', () => {
    expect(usageMeter({ contextPct: 41, costUsd: 1.234, timestamp: 0 })).toEqual({
      label: 'context',
      pct: 41,
      detail: '$1.23'
    })
  })

  it('clamps to 0–100 and shows nothing without data', () => {
    expect(usageMeter({ sessionPct: 130, timestamp: 0 })?.pct).toBe(100)
    expect(usageMeter({ timestamp: 0 })).toBeNull()
  })

  it('colors by level', () => {
    expect([10, 50, 79, 80].map(meterLevel)).toEqual(['ok', 'warn', 'warn', 'high'])
  })
})

describe('crossedWarning', () => {
  it('fires when session usage passes 50 / 80 / 95 %', () => {
    expect(crossedWarning({ sessionPct: 49, timestamp: 0 }, { sessionPct: 51, timestamp: 0 })).toBe(
      true
    )
    expect(crossedWarning({ sessionPct: 51, timestamp: 0 }, { sessionPct: 60, timestamp: 0 })).toBe(
      false
    )
    expect(crossedWarning({ sessionPct: 79, timestamp: 0 }, { sessionPct: 96, timestamp: 0 })).toBe(
      true
    )
  })

  it('fires when the cost passes $1 / $5 / $20', () => {
    expect(crossedWarning({ costUsd: 0.9, timestamp: 0 }, { costUsd: 1.1, timestamp: 0 })).toBe(
      true
    )
  })

  it('stays calm on the first reading after start-up', () => {
    expect(crossedWarning(null, { sessionPct: 90, timestamp: 0 })).toBe(false)
  })
})
