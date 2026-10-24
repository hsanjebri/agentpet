import type { PetEvent, PetEventType } from '@shared/events'
import { describe, expect, it } from 'vitest'
import {
  IDLE_MS,
  type MoodInput,
  type MoodState,
  TEMP_MS,
  currentMood,
  initialMoodState,
  nextChangeAt,
  nextMoodState
} from '../src/renderer/src/moodMachine'

const ev = (type: PetEventType): MoodInput => ({
  type: 'event',
  event: { type, agent: 'claude-code', timestamp: 0 } satisfies PetEvent
})

/** Applies inputs one after another, each at its own time. */
function run(steps: Array<[at: number, input: MoodInput]>, start = initialMoodState(0)): MoodState {
  return steps.reduce((state, [at, input]) => nextMoodState(state, input, at), start)
}

describe('mood machine', () => {
  it('starts asleep', () => {
    expect(currentMood(initialMoodState(0), 0)).toBe('sleeping')
  })

  it.each<PetEventType>(['working', 'tool', 'tool_done'])('%s wakes the pet up to work', (type) => {
    expect(currentMood(run([[10, ev(type)]]), 10)).toBe('working')
  })

  it('falls back asleep after 2 minutes without events', () => {
    const state = run([[0, ev('tool')]])
    expect(currentMood(state, IDLE_MS - 1)).toBe('working')
    expect(currentMood(state, IDLE_MS)).toBe('sleeping')
  })

  describe('needs', () => {
    it('shows on needs_you and stays until the agent carries on', () => {
      const state = run([
        [0, ev('working')],
        [10, ev('needs_you')]
      ])
      expect(currentMood(state, 10)).toBe('needs')
      expect(currentMood(state, IDLE_MS * 10)).toBe('needs') // never falls asleep on you
      expect(currentMood(nextMoodState(state, ev('tool'), 20), 20)).toBe('working')
    })

    it('clears when the pet is clicked', () => {
      const state = run([
        [0, ev('needs_you')],
        [5, { type: 'pet_clicked' }]
      ])
      expect(currentMood(state, 5)).toBe('sleeping')
    })

    it.each<[string, MoodInput]>([
      ['error', ev('error')],
      ['risky', ev('risky')],
      ['sweat', { type: 'sweat' }]
    ])('beats a %s that arrives meanwhile', (_, input) => {
      const state = run([
        [0, ev('needs_you')],
        [10, input]
      ])
      expect(currentMood(state, 10)).toBe('needs')
    })

    it('is over when the turn ends', () => {
      const state = run([
        [0, ev('needs_you')],
        [10, ev('done')]
      ])
      expect(currentMood(state, 10)).toBe('happy')
    })
  })

  describe('short moods', () => {
    it('done: happy for 5 s, then asleep', () => {
      const state = run([
        [0, ev('working')],
        [100, ev('done')]
      ])
      expect(currentMood(state, 100 + TEMP_MS.happy - 1)).toBe('happy')
      expect(currentMood(state, 100 + TEMP_MS.happy)).toBe('sleeping')
    })

    it('done: new work ends the celebration early', () => {
      const state = run([
        [0, ev('done')],
        [1000, ev('working')]
      ])
      expect(currentMood(state, 1000)).toBe('working')
    })

    it('error: sad for 5 s, then back to the previous mood', () => {
      const state = run([
        [0, ev('working')],
        [10, ev('error')]
      ])
      expect(currentMood(state, 10)).toBe('sad')
      expect(currentMood(state, 10 + TEMP_MS.sad)).toBe('working')
    })

    it('risky: hiss for 4 s', () => {
      const state = run([
        [0, ev('working')],
        [10, ev('risky')]
      ])
      expect(currentMood(state, 10 + TEMP_MS.hiss - 1)).toBe('hiss')
      expect(currentMood(state, 10 + TEMP_MS.hiss)).toBe('working')
    })

    it('sweat: 4 s, then back', () => {
      const state = run([
        [0, ev('working')],
        [10, { type: 'sweat' }]
      ])
      expect(currentMood(state, 10)).toBe('sweat')
      expect(currentMood(state, 10 + TEMP_MS.sweat)).toBe('working')
    })

    it('work keeps sad / hiss / sweat showing until they time out', () => {
      const state = run([
        [0, ev('error')],
        [10, ev('tool')]
      ])
      expect(currentMood(state, 10)).toBe('sad')
      expect(currentMood(state, TEMP_MS.sad)).toBe('working')
    })
  })

  describe('priority: needs > hiss > sad > happy > sweat > working > sleeping', () => {
    it('a lower short mood does not replace a higher one', () => {
      const state = run([
        [0, ev('risky')],
        [10, ev('error')],
        [20, ev('done')],
        [30, { type: 'sweat' }]
      ])
      expect(currentMood(state, 30)).toBe('hiss')
    })

    it('a higher short mood replaces a lower one', () => {
      const state = run([
        [0, { type: 'sweat' }],
        [10, ev('done')],
        [20, ev('error')],
        [30, ev('risky')]
      ])
      expect(currentMood(state, 30)).toBe('hiss')
    })

    it('a lower mood can show once the higher one has timed out', () => {
      const state = run([
        [0, ev('risky')],
        [TEMP_MS.hiss + 1, ev('error')]
      ])
      expect(currentMood(state, TEMP_MS.hiss + 1)).toBe('sad')
    })
  })

  it('session_end sends the pet to sleep and clears needs', () => {
    const state = run([
      [0, ev('working')],
      [5, ev('needs_you')],
      [10, ev('session_end')]
    ])
    expect(currentMood(state, 10)).toBe('sleeping')
  })

  describe('nextChangeAt', () => {
    it('is the earliest timeout, or null when nothing will change', () => {
      expect(nextChangeAt(initialMoodState(0))).toBeNull()
      expect(nextChangeAt(run([[0, ev('working')]]))).toBe(IDLE_MS)
      expect(nextChangeAt(run([[0, ev('working')], [10, ev('error')]]))).toBe(10 + TEMP_MS.sad) // prettier-ignore
    })
  })
})
