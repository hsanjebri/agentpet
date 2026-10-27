import { describe, expect, it } from 'vitest'
import { type HostState, parseVisitMessage, refusal, refusalText } from '@shared/visits'

const OPEN: HostState = {
  accepts: 'friends',
  hosting: false,
  away: false,
  focusRound: false,
  bedtime: false,
  hidden: false,
  isFriend: true
}

describe('visit messages', () => {
  it('reads a knock, keeping only what Friends already shares', () => {
    expect(
      parseVisitMessage('visit', {
        visitId: 'v1',
        from: 'u1',
        name: 'Mochi',
        skin: 'mochi',
        level: 12.7,
        sneaky: 'ignored'
      })
    ).toEqual({ type: 'visit', visitId: 'v1', from: 'u1', name: 'Mochi', skin: 'mochi', level: 12 })
  })

  it('drops anything malformed', () => {
    expect(parseVisitMessage('visit', { visitId: 'v1', name: 'Mochi' })).toBeNull() // no sender
    expect(parseVisitMessage('visit', { from: 'u1', name: 'x' })).toBeNull() // no id
    expect(parseVisitMessage('rm -rf', { visitId: 'v1' })).toBeNull()
    expect(parseVisitMessage('visit', 'hello')).toBeNull()
    expect(
      parseVisitMessage('visit', { visitId: 'v', from: 'u', name: 'x'.repeat(40), skin: 'mochi' })
    ).toBeNull()
  })

  it('unknown skins become Noodle, unknown reasons "busy"', () => {
    expect(
      parseVisitMessage('visit', { visitId: 'v', from: 'u', name: 'B', skin: 'dragon' })
    ).toMatchObject({ skin: 'noodle', level: 1 })
    expect(parseVisitMessage('visit_no', { visitId: 'v', reason: 'hmm' })).toMatchObject({
      reason: 'busy'
    })
  })
})

describe('may a guest come in?', () => {
  it('yes when friends, open and free', () => {
    expect(refusal(OPEN)).toBeNull()
  })

  it('never from strangers or when visits are off', () => {
    expect(refusal({ ...OPEN, isFriend: false })).toBe('nobody')
    expect(refusal({ ...OPEN, accepts: 'nobody' })).toBe('nobody')
  })

  it('not during focus, bedtime, another visit or auto-hide', () => {
    expect(refusal({ ...OPEN, focusRound: true })).toBe('focus')
    expect(refusal({ ...OPEN, bedtime: true })).toBe('asleep')
    expect(refusal({ ...OPEN, hosting: true })).toBe('busy')
    expect(refusal({ ...OPEN, away: true })).toBe('busy')
    expect(refusal({ ...OPEN, hidden: true })).toBe('busy')
    expect(refusalText('Mochi', 'focus')).toContain('focus session')
  })
})
