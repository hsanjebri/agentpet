import { describe, expect, it } from 'vitest'
import {
  type Activity,
  type Progress,
  XP_PER_LEVEL,
  dayKey,
  emptyProgress,
  isHungry,
  levelOf,
  lookOf,
  recap,
  record,
  rollRare,
  shareText,
  stageOf,
  streak,
  timeMood
} from '@shared/progress'

const DAY = 24 * 60 * 60_000
// a Wednesday, 15:00 local time
const NOW = new Date(2026, 9, 21, 15, 0, 0).getTime()

function apply(activities: Activity[], start = emptyProgress(), at = NOW): Progress {
  return activities.reduce((p, a) => record(p, a, at).progress, start)
}

const done: Activity = { type: 'task_done', rare: null }

describe('levels and evolution', () => {
  it('levels up every 100 XP (10 tasks)', () => {
    expect(levelOf(0)).toBe(1)
    expect(levelOf(XP_PER_LEVEL)).toBe(2)
    const nine = apply(Array(9).fill(done))
    const { milestones } = record(nine, done, NOW)
    expect(milestones).toContainEqual({ type: 'level_up', level: 2 })
  })

  it('grows from kitten to cat to senior', () => {
    expect([1, 4, 5, 19, 20].map(stageOf)).toEqual(['kitten', 'kitten', 'cat', 'cat', 'senior'])
  })
})

describe('accessories', () => {
  it('unlocks the top hat at 100 tasks, and puts it on', () => {
    const p = apply(Array(99).fill(done))
    expect(p.unlocked).toEqual([])
    const { progress, milestones } = record(p, done, NOW)
    expect(milestones).toContainEqual({ type: 'unlocked', item: 'tophat' })
    expect(lookOf(progress, NOW).wearing).toEqual(['tophat'])
  })

  it('unlocks the crown at 1,000 approvals', () => {
    const p = { ...emptyProgress(), totalApprovals: 999 }
    expect(record(p, { type: 'approved' }, NOW).milestones).toContainEqual({
      type: 'unlocked',
      item: 'crown'
    })
  })

  it('unlocks sunglasses after a 7-day streak', () => {
    let p = emptyProgress()
    for (let i = 6; i >= 0; i--) p = record(p, { type: 'tool' }, NOW - i * DAY).progress
    expect(p.unlocked).toContain('sunglasses')
  })
})

describe('streak', () => {
  it('counts active days in a row, today optional', () => {
    let p = emptyProgress()
    for (const ago of [1, 2, 3, 5]) p = record(p, { type: 'tool' }, NOW - ago * DAY).progress
    expect(streak(p, NOW)).toBe(3) // yesterday + 2 more; the gap stops it
    p = record(p, { type: 'tool' }, NOW).progress
    expect(streak(p, NOW)).toBe(4)
  })
})

describe('feeding', () => {
  it('every finished task is a fish; hungry after 3 days without', () => {
    const p = apply([done])
    expect(p.lastFedAt).toBe(NOW)
    expect(isHungry(p, NOW + 2 * DAY)).toBe(false)
    expect(isHungry(p, NOW + 4 * DAY)).toBe(true)
    expect(isHungry(emptyProgress(), NOW)).toBe(false) // never fed yet: not hungry
  })
})

describe('rare moments', () => {
  it('happens 1 in 50, picking one of the kinds', () => {
    expect(rollRare(() => 0.5)).toBeNull()
    const rolls = [0.001, 0.9] // rare, then pick the last kind
    expect(rollRare(() => rolls.shift()!)).toBe('keyboard')
  })

  it('a double fart counts two rainbows', () => {
    const p = apply([done, { type: 'task_done', rare: 'double' }])
    expect(p.totalRainbows).toBe(3)
    expect(recap(p, 'day', NOW).rainbows).toBe(3)
  })
})

describe('recap', () => {
  it('sums today: tasks, approvals, files, favorite file', () => {
    const p = apply([
      done,
      done,
      { type: 'approved' },
      { type: 'tool', toolName: 'Edit', target: 'C:\\app\\src\\App.tsx' },
      { type: 'tool', toolName: 'Edit', target: '/app/src/App.tsx' },
      { type: 'tool', toolName: 'Write', target: '/app/README.md' },
      { type: 'tool', toolName: 'Read', target: '/app/package.json' }
    ])
    expect(recap(p, 'day', NOW)).toMatchObject({
      title: 'Today',
      tasks: 2,
      approvals: 1,
      filesEdited: 2,
      favoriteFile: 'App.tsx',
      busiestHour: 15
    })
  })

  it('weekly: busiest day and the scariest (late-night) moment', () => {
    let p = emptyProgress()
    const monday = NOW - 2 * DAY
    for (let i = 0; i < 5; i++) p = record(p, done, monday).progress
    p = record(p, done, NOW).progress
    const twoAm = new Date(2026, 9, 20, 2, 0).getTime()
    p = record(p, { type: 'risky', reason: 'rm -rf' }, twoAm).progress
    p = record(p, { type: 'risky', reason: 'touching .env' }, NOW).progress
    const week = recap(p, 'week', NOW)
    expect(week.busiestDay).toBe('Monday')
    expect(week.tasks).toBe(6)
    expect(week.scariestMoment).toEqual({ reason: 'rm -rf', at: twoAm })
  })

  it('builds the share text', () => {
    const text = shareText(recap(apply([done, { type: 'approved' }]), 'day', NOW))
    expect(text).toBe(
      'Today my AI agent finished 1 task, I approved 1 time, Noodle farted 1 rainbow 🌈. #AgentPet'
    )
  })

  it('only keeps the last 60 days', () => {
    let p = emptyProgress()
    for (let i = 70; i >= 0; i--) p = record(p, { type: 'tool' }, NOW - i * DAY).progress
    expect(Object.keys(p.days)).toHaveLength(60)
    expect(p.days[dayKey(NOW)]).toBeDefined()
  })
})

describe('time of day', () => {
  it('late night, morning, and Friday party hat', () => {
    expect(timeMood(new Date(2026, 9, 21, 3).getTime()).greeting).toBe('late_night')
    expect(timeMood(new Date(2026, 9, 21, 8).getTime()).greeting).toBe('morning')
    expect(timeMood(NOW).greeting).toBeNull()
    expect(timeMood(new Date(2026, 9, 23, 12).getTime()).partyHat).toBe(true) // Friday
    expect(timeMood(NOW).partyHat).toBe(false)
  })
})
