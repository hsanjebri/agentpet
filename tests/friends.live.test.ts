// Live test against the real Supabase project in config/supabase.json: two anonymous users run
// the app's own FriendsService end to end, plus direct checks of the security rules.
// Skipped unless AGENTPET_LIVE=1 (it creates two anonymous test users and their rows).
//   AGENTPET_LIVE=1 npx vitest run tests/friends.live.test.ts
import { type SupabaseClient, createClient } from '@supabase/supabase-js'
import type { FriendsView } from '@shared/friends'
import { describe, expect, it } from 'vitest'
import config from '../config/supabase.json'
import { FriendsService, type SessionStorage } from '../src/main/friendsService'

const live = process.env.AGENTPET_LIVE === '1'

function memoryStorage(): SessionStorage {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k)
  }
}

function user(name: string, skin: string): { service: FriendsService; views: FriendsView[] } {
  const views: FriendsView[] = []
  const service = new FriendsService({
    config,
    createClient: async (url, key, options) => createClient(url, key, options),
    storage: memoryStorage(),
    pet: () => ({ name, skin, level: 3 }),
    onView: (v) => views.push(v),
    pollMs: 2000
  })
  return { service, views }
}

async function until(check: () => boolean, ms = 15_000): Promise<void> {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 250))
  }
}

describe.skipIf(!live)('Friends against the live Supabase project', () => {
  it('two pets: codes, add, accept, online dots, remove, block', async () => {
    const a = user('Testa', 'mochi')
    const b = user('Testb', 'zitouna')
    await a.service.enable()
    await b.service.enable()
    expect(a.service.current().status).toBe('online')
    expect(b.service.current().status).toBe('online')
    const codeA = a.service.current().myCode!
    const codeB = b.service.current().myCode!
    expect(codeA).toMatch(/^TESTA-[A-HJ-NP-Z2-9]{4}$/)
    console.log('codes', codeA, codeB)

    // A adds B (typed loosely); B sees the request with A's name
    expect(await a.service.command({ type: 'add', code: codeB.toLowerCase() })).toMatchObject({
      ok: true,
      message: expect.stringContaining('Request sent')
    })
    expect(await a.service.command({ type: 'add', code: codeA })).toMatchObject({ ok: false })
    await b.service.command({ type: 'retry' })
    const incoming = b.service.current().incoming
    expect(incoming).toMatchObject([{ name: 'Testa', skin: 'mochi', code: codeA }])
    expect(a.service.current().outgoing).toMatchObject([{ name: 'Testb' }])

    // B accepts: friends on both sides, and both online dots turn green
    expect(
      await b.service.command({ type: 'respond', id: incoming[0].id, action: 'accept' })
    ).toMatchObject({ ok: true })
    await a.service.command({ type: 'retry' })
    expect(a.service.current().friends).toMatchObject([{ name: 'Testb', level: 3 }])
    await until(() => a.service.current().friends[0]?.online === true)
    await until(() => b.service.current().friends[0]?.online === true)
    console.log('online dots: both green')

    // B goes offline: A's dot turns grey
    b.service.disable()
    await until(() => a.service.current().friends[0]?.online === false)
    await b.service.enable()

    // A removes B, adds again, B blocks A: A can't find B any more
    const id = a.service.current().friends[0].id
    expect(await a.service.command({ type: 'respond', id, action: 'remove' })).toMatchObject({
      ok: true
    })
    expect(a.service.current().friends).toEqual([])
    await a.service.command({ type: 'add', code: codeB })
    await b.service.command({ type: 'retry' })
    const again = b.service.current().incoming[0]
    await b.service.command({ type: 'respond', id: again.id, action: 'block' })
    expect(b.service.current().blocked).toMatchObject([{ name: 'Testa' }])
    expect(await a.service.command({ type: 'add', code: codeB })).toMatchObject({
      ok: false,
      message: 'No pet with that code.'
    })
    await a.service.command({ type: 'retry' })
    expect(a.service.current().outgoing).toEqual([]) // the block isn't shown to A

    // tidy up: B unblocks (deletes the row)
    await b.service.command({ type: 'respond', id: again.id, action: 'unblock' })
    a.service.disable()
    b.service.disable()
  }, 90_000)

  it('visits: friends can knock on each other’s channel, strangers cannot', async () => {
    const a = user('Visita', 'noodle')
    const b = user('Visitb', 'mochi')
    const gotB: Array<[string, unknown]> = []
    const gotA: Array<[string, unknown]> = []
    b.service.setMessageHandler((event, payload) => gotB.push([event, payload]))
    a.service.setMessageHandler((event, payload) => gotA.push([event, payload]))
    await a.service.enable()
    await b.service.enable()
    await a.service.command({ type: 'add', code: b.service.current().myCode! })
    await b.service.command({ type: 'retry' })
    const req = b.service.current().incoming[0]
    await b.service.command({ type: 'respond', id: req.id, action: 'accept' })
    await a.service.command({ type: 'retry' })
    const idA = a.service.myId()!
    const idB = b.service.myId()!
    await until(() => a.service.current().friends[0]?.online === true)
    await until(() => b.service.current().friends[0]?.online === true)

    // A knocks, B answers: both messages arrive on the private channels
    expect(await a.service.sendTo(idB, 'visit', { visitId: 'v1', from: idA, name: 'Visita' })).toBe(
      true
    )
    await until(() => gotB.length > 0)
    expect(gotB[0]).toEqual(['visit', expect.objectContaining({ visitId: 'v1', name: 'Visita' })])
    expect(await b.service.sendTo(idA, 'visit_ok', { visitId: 'v1' })).toBe(true)
    await until(() => gotA.length > 0)
    expect(gotA[0]).toEqual(['visit_ok', { visitId: 'v1' }])

    // a stranger can't even join B's channel (Realtime Authorization), so nothing arrives
    const stranger = createClient(config.url, config.anonKey, {
      auth: { storage: memoryStorage(), persistSession: false, autoRefreshToken: false }
    })
    await stranger.auth.signInAnonymously()
    await stranger.realtime.setAuth()
    let joined = ''
    const ch = stranger.channel(`pet:${idB}`, { config: { private: true } })
    ch.subscribe((status) => (joined = status))
    await until(
      () => (joined !== '' && joined !== 'SUBSCRIBED' ? true : joined === 'SUBSCRIBED'),
      10_000
    )
    const before = gotB.length
    await ch.send({
      type: 'broadcast',
      event: 'visit',
      payload: { visitId: 'evil', from: 'x', name: 'Evil' }
    })
    await new Promise((r) => setTimeout(r, 2000))
    expect(joined).not.toBe('SUBSCRIBED')
    expect(gotB.length).toBe(before)
    await stranger.removeAllChannels()

    // tidy up
    await a.service.command({
      type: 'respond',
      id: a.service.current().friends[0].id,
      action: 'remove'
    })
    a.service.disable()
    b.service.disable()
  }, 90_000)

  it('the rules: strangers see nothing, nobody writes another pet, no service tricks', async () => {
    const mk = (): SupabaseClient =>
      createClient(config.url, config.anonKey, {
        auth: { storage: memoryStorage(), persistSession: false, autoRefreshToken: false }
      })
    const x = mk()
    const y = mk()
    const sx = await x.auth.signInAnonymously()
    const sy = await y.auth.signInAnonymously()
    const idY = sy.data.user!.id
    await x.rpc('upsert_my_pet', { p_name: 'Rulex', p_skin: 'noodle', p_level: 1 })
    await y.rpc('upsert_my_pet', { p_name: 'Ruley', p_skin: 'noodle', p_level: 1 })

    // x can read only its own pet row
    const { data: seen } = await x.from('pets').select('user_id, pet_name')
    expect(seen?.map((r) => r.pet_name)).toEqual(['Rulex'])
    // x can't change y's pet, nor create a row for y
    await x.from('pets').update({ level: 999 }).eq('user_id', idY)
    const { data: yPet } = await y.from('pets').select('level').single()
    expect(yPet?.level).toBe(1)
    const fake = await x
      .from('pets')
      .insert({ user_id: idY, friend_code: 'FAKE-ABCD', pet_name: 'x', skin: 'noodle' })
    expect(fake.error).toBeTruthy()
    // x can't make y its friend directly (accepted) or answer its own request
    const forced = await x
      .from('friendships')
      .insert({ requester: sx.data.user!.id, addressee: idY, status: 'accepted' })
    expect(forced.error).toBeTruthy()
    // the request log is invisible
    const { data: log } = await x.from('friend_request_log').select('*')
    expect(log).toEqual([])
    // signed-out (anon key only) callers can't use the functions
    const outsider = await mk().rpc('friends_overview')
    expect(outsider.error).toBeTruthy()
  }, 60_000)
})
