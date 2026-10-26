import { describe, expect, it } from 'vitest'
import { VISIBLE, anyAutoHide, hideReason, parseOsLine } from '@shared/autoHide'

const ALL = { fullscreen: true, meetings: true, dnd: true }

describe('auto-hide', () => {
  it('reads the watcher lines, and survives garbage', () => {
    expect(parseOsLine('{"fullscreen":true,"mic":false,"dnd":false}')).toEqual({
      fullscreen: true,
      mic: false,
      dnd: false
    })
    expect(parseOsLine('Add-Type: oops')).toBeNull()
  })

  it('hides only for the reasons switched on', () => {
    expect(hideReason({ ...VISIBLE, mic: true }, ALL)).toBe('meeting')
    expect(hideReason({ ...VISIBLE, mic: true }, { ...ALL, meetings: false })).toBeNull()
    expect(hideReason({ ...VISIBLE, fullscreen: true }, ALL)).toBe('fullscreen')
    expect(hideReason({ ...VISIBLE, dnd: true }, { ...ALL, dnd: false })).toBeNull()
    expect(hideReason(VISIBLE, ALL)).toBeNull()
  })

  it('the watcher only runs when a switch is on', () => {
    expect(anyAutoHide({ fullscreen: false, meetings: false, dnd: false })).toBe(false)
    expect(anyAutoHide({ fullscreen: false, meetings: true, dnd: false })).toBe(true)
  })
})
