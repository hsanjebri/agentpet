import { describe, expect, it } from 'vitest'
import { daysUntil, minutesPastBedtime } from '@shared/habits'
import { type Activity, type Progress, emptyProgress, focusStreak, record } from '@shared/progress'
import { cleanChange } from '@shared/settings'

const at = (h: number, m = 0, day = 27): number => new Date(2026, 9, day, h, m).getTime()

describe('bedtime', () => {
  it('runs from bedtime until 6:00, across midnight', () => {
    expect(minutesPastBedtime('23:30', at(23, 0))).toBeNull()
    expect(minutesPastBedtime('23:30', at(23, 45))).toBe(15)
    expect(minutesPastBedtime('23:30', at(1, 0))).toBe(90)
    expect(minutesPastBedtime('23:30', at(6, 0))).toBeNull()
    expect(minutesPastBedtime('23:30', at(14, 0))).toBeNull()
  })

  it('works for a bedtime after midnight too', () => {
    expect(minutesPastBedtime('01:00', at(0, 30))).toBeNull()
    expect(minutesPastBedtime('01:00', at(2, 0))).toBe(60)
    expect(minutesPastBedtime('01:00', at(23, 0))).toBeNull()
  })
})

describe('countdown', () => {
  it('counts whole days, today = 0, past = negative', () => {
    expect(daysUntil('2026-11-19', at(9))).toBe(23)
    expect(daysUntil('2026-10-27', at(23, 59))).toBe(0)
    expect(daysUntil('2026-10-20', at(9))).toBe(-7)
  })

  it('validates the setting', () => {
    expect(cleanChange({ countdown: { label: ' Bac ', date: '2027-06-10' } })).toEqual({
      countdown: { label: 'Bac', date: '2027-06-10' }
    })
    expect(cleanChange({ countdown: { label: 'Bac', date: 'soon' } })).toEqual({})
    expect(cleanChange({ bedtime: { at: '25:00' } })).toEqual({ bedtime: {} })
    expect(cleanChange({ bedtime: { at: '23:15' } })).toEqual({ bedtime: { at: '23:15' } })
  })
})

describe('study streak', () => {
  const pomodoro: Activity = { type: 'pomodoro' }
  const DAY = 24 * 60 * 60_000

  it('counts days in a row with a Pomodoro, and celebrates day 5', () => {
    let p: Progress = emptyProgress()
    const milestones: unknown[] = []
    for (let d = 4; d >= 0; d--) {
      const r = record(p, pomodoro, at(10) - d * DAY)
      p = r.progress
      milestones.push(...r.milestones.filter((m) => m.type === 'streak'))
    }
    expect(focusStreak(p, at(10))).toBe(5)
    expect(milestones).toEqual([
      { type: 'streak', days: 3 },
      { type: 'streak', days: 5 }
    ])
    // a second round the same day doesn't celebrate again
    expect(record(p, pomodoro, at(15)).milestones.some((m) => m.type === 'streak')).toBe(false)
  })
})
