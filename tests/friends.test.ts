import { describe, expect, it, vi } from 'vitest'
import { addResultMessage, normalizeCode, viewFromRows } from '@shared/friends'
import { FriendsService, type FriendsDeps, isConfigured } from '../src/main/friendsService'

const CONFIG = { url: 'https://example.supabase.co', anonKey: 'x'.repeat(40) }

function deps(overrides: Partial<FriendsDeps> = {}): FriendsDeps {
  return {
    config: CONFIG,
    createClient: vi.fn(),
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    pet: () => ({ name: 'Noodle', skin: 'noodle', level: 3 }),
    onView: () => {},
    ...overrides
  }
}

describe('Friends: privacy', () => {
  it('while off, no client is created and nothing touches the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const d = deps()
    const service = new FriendsService(d)
    expect(service.current().status).toBe('off')
    expect(await service.command({ type: 'add', code: 'MOCHI-7K2P' })).toMatchObject({
      ok: false
    })
    await service.syncPet()
    expect(d.createClient).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('a build without a Supabase project never connects', async () => {
    const d = deps({ config: { url: '', anonKey: '' } })
    const service = new FriendsService(d)
    await service.enable()
    expect(service.current().status).toBe('unconfigured')
    expect(d.createClient).not.toHaveBeenCalled()
    expect(isConfigured({ url: 'http://insecure', anonKey: 'x'.repeat(40) })).toBe(false)
  })

  it('server down: says offline, nothing throws, and switching off stops retrying', async () => {
    vi.useFakeTimers()
    const d = deps({ createClient: vi.fn().mockRejectedValue(new Error('down')), retryMs: 1000 })
    const service = new FriendsService(d)
    await service.enable()
    expect(service.current().status).toBe('offline')
    service.disable()
    await vi.advanceTimersByTimeAsync(5000)
    expect(d.createClient).toHaveBeenCalledTimes(1)
    expect(service.current().status).toBe('off')
    vi.useRealTimers()
  })
})

describe('friend codes', () => {
  it('accepts the ways people type them', () => {
    expect(normalizeCode('noodle-48k2')).toBe('NOODLE-48K2')
    expect(normalizeCode(' Noodle 48K2 ')).toBe('NOODLE-48K2')
    expect(normalizeCode('PETAB2C')).toBe('PET-AB2C')
  })

  it('refuses codes with look-alike characters or the wrong shape', () => {
    expect(normalizeCode('NOODLE-48O2')).toBeNull() // O in the random part
    expect(normalizeCode('NOODLE-1234')).toBeNull() // 1
    expect(normalizeCode('NOODLE-0K2P')).toBeNull() // 0
    expect(normalizeCode('N-4821')).toBeNull()
    expect(normalizeCode('')).toBeNull()
  })

  it('explains every answer from the server', () => {
    expect(addResultMessage('sent').ok).toBe(true)
    expect(addResultMessage('limit').message).toContain('20')
    expect(addResultMessage('not_found').ok).toBe(false)
  })

  it('sorts overview rows into the lists, with online dots', () => {
    const rows = [
      {
        id: 1,
        kind: 'friend',
        user_id: 'a',
        pet_name: 'Mochi',
        skin: 'mochi',
        level: 12,
        friend_code: 'MOCHI-7K2P'
      },
      {
        id: 2,
        kind: 'incoming',
        user_id: 'b',
        pet_name: 'Zito',
        skin: 'zitouna',
        level: 2,
        friend_code: 'ZT-93HD'
      }
    ]
    const view = viewFromRows(rows, new Set(['a']))
    expect(view.friends).toMatchObject([{ name: 'Mochi', online: true }])
    expect(view.incoming).toMatchObject([{ name: 'Zito', online: false }])
    expect(view.outgoing).toEqual([])
  })
})
