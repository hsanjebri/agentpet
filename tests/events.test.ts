import { describe, expect, it } from 'vitest'
import { parsePetEvent } from '../src/shared/events'

describe('parsePetEvent', () => {
  it('accepts a minimal valid event', () => {
    expect(parsePetEvent({ type: 'needs_you', agent: 'claude-code', timestamp: 0 })).toEqual({
      type: 'needs_you',
      agent: 'claude-code',
      sessionId: undefined,
      cwd: undefined,
      toolName: undefined,
      target: undefined,
      message: undefined,
      timestamp: 0
    })
  })

  it('rejects non-objects and unknown types', () => {
    expect(parsePetEvent(null)).toBeNull()
    expect(parsePetEvent('needs_you')).toBeNull()
    expect(parsePetEvent({ type: 'explode', agent: 'claude-code' })).toBeNull()
  })

  it('falls back to unknown agent and current time', () => {
    const event = parsePetEvent({ type: 'done', agent: 'skynet' })
    expect(event?.agent).toBe('unknown')
    expect(typeof event?.timestamp).toBe('number')
  })

  it('drops non-string fields and truncates long text', () => {
    const event = parsePetEvent({
      type: 'tool',
      agent: 'claude-code',
      toolName: 42,
      target: 'x'.repeat(500)
    })
    expect(event?.toolName).toBeUndefined()
    expect(event?.target).toHaveLength(200)
    expect(event?.target?.endsWith('…')).toBe(true)
  })
})
