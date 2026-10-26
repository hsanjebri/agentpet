import { describe, expect, it } from 'vitest'
import {
  RISK_KINDS,
  applyChange,
  cleanChange,
  defaultSettings,
  withDefaults
} from '@shared/settings'

describe('settings migration', () => {
  it('keeps every value from an older settings file and fills in the new ones', () => {
    // what 0.4.1 wrote (plus bookkeeping that isn't a setting)
    const old = {
      skin: 'mochi',
      muted: true,
      focusMode: true,
      wander: false,
      music: false,
      windowPosition: { x: 1, y: 2 },
      connectPromptShown: true
    }
    const s = withDefaults(old)
    expect(s).toMatchObject({ skin: 'mochi', muted: true, focusMode: true, wander: false })
    expect(s.music).toBe(false)
    // new settings get their defaults
    expect(s.size).toBe('m')
    expect(s.mode).toBe('developer')
    expect(s.sounds.volume).toBe(0.8)
    expect(s.pomodoro.focusMin).toBe(25)
    expect(s.friends).toBe(false)
    expect(Object.keys(s)).not.toContain('windowPosition')
  })

  it('an empty file is the defaults', () => {
    expect(withDefaults({})).toEqual(defaultSettings())
    expect(withDefaults(undefined)).toEqual(defaultSettings())
  })
})

describe('settings changes from a window', () => {
  it('drops unknown keys and bad values', () => {
    expect(
      cleanChange({
        skin: 'byte', // not drawn yet
        size: 'xl',
        mode: 'boss',
        muted: 'yes',
        hacker: true,
        sounds: { volume: 7, meow: 'no', tick: true },
        pomodoro: { focusMin: 0, rounds: 99, breakMin: 'x' }
      })
    ).toEqual({ sounds: { volume: 1, tick: true }, pomodoro: { focusMin: 1, rounds: 12 } })
  })

  it('merges nested settings instead of replacing them', () => {
    const before = defaultSettings()
    const after = applyChange(before, cleanChange({ sounds: { meow: false } }))
    expect(after.sounds).toEqual({ ...before.sounds, meow: false })
    expect(after.risks).toEqual(before.risks)
  })

  it('start on login is passed on but never stored', () => {
    const change = cleanChange({ startOnLogin: true, wander: false })
    expect(change.startOnLogin).toBe(true)
    expect(applyChange(defaultSettings(), change)).not.toHaveProperty('startOnLogin')
  })

  it('cleans the risk allow-list', () => {
    const { riskAllow } = cleanChange({ riskAllow: ['  .env.example ', '', 42, 'rm -rf dist'] })
    expect(riskAllow).toEqual(['.env.example', 'rm -rf dist'])
  })

  it('every risk kind is on by default', () => {
    expect(RISK_KINDS.every((k) => defaultSettings().risks[k])).toBe(true)
  })
})
