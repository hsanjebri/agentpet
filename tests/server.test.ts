import type { Server } from 'http'
import type { AddressInfo } from 'net'
import type { PermissionDecision, PetEvent, UsageInfo } from '@shared/events'
import { afterEach, describe, expect, it } from 'vitest'
import { PermissionQueue } from '../src/main/permissions'
import { type PermissionInfo, createAgentServer, startAgentServer } from '../src/main/server'

let server: Server | undefined

afterEach(() => {
  server?.close()
  server = undefined
})

function start(overrides: Partial<Parameters<typeof createAgentServer>[0]> = {}): {
  url: string
  events: PetEvent[]
  usage: UsageInfo[]
} {
  const events: PetEvent[] = []
  const usage: UsageInfo[] = []
  server = createAgentServer({
    onEvent: (e) => events.push(e),
    onUsage: (u) => usage.push(u),
    onPermission: async () => null,
    ...overrides
  })
  server.listen(0, '127.0.0.1')
  const url = (): string => `http://127.0.0.1:${(server!.address() as AddressInfo).port}`
  return {
    get url() {
      return url()
    },
    events,
    usage
  }
}

const listening = (): Promise<void> => new Promise((r) => server!.once('listening', () => r()))

describe('event server', () => {
  it('answers /health', async () => {
    const s = start()
    await listening()
    expect(await (await fetch(`${s.url}/health`)).json()).toEqual({ ok: true, app: 'agentpet' })
  })

  it('accepts a valid event (the Phase 2 curl test)', async () => {
    const s = start()
    await listening()
    const res = await fetch(`${s.url}/event`, {
      method: 'POST',
      body: '{"type":"needs_you","agent":"claude-code","timestamp":0}'
    })
    expect(res.status).toBe(204)
    expect(s.events[0]).toMatchObject({ type: 'needs_you', agent: 'claude-code' })
  })

  it('rejects bad events, unknown routes and huge bodies', async () => {
    const s = start()
    await listening()
    const post = (path: string, body: string): Promise<number> =>
      fetch(`${s.url}${path}`, { method: 'POST', body }).then((r) => r.status)
    expect(await post('/event', '{"type":"explode"}')).toBe(400)
    expect(await post('/event', 'not json')).toBe(400)
    expect(await post('/nope', '{}')).toBe(404)
    expect(await post('/event', JSON.stringify({ type: 'tool', pad: 'x'.repeat(70_000) }))).toBe(
      413
    )
    expect(s.events).toHaveLength(0)
  })

  it('rejects requests from web pages (Origin header)', async () => {
    const s = start()
    await listening()
    const res = await fetch(`${s.url}/event`, {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
      body: '{"type":"done","agent":"claude-code"}'
    })
    expect(res.status).toBe(403)
    expect(s.events).toHaveLength(0)
  })

  it('forwards usage', async () => {
    const s = start()
    await listening()
    await fetch(`${s.url}/usage`, { method: 'POST', body: '{"sessionPct":42,"contextPct":7}' })
    expect(s.usage[0]).toMatchObject({ sessionPct: 42, contextPct: 7 })
  })

  it('holds a permission request until the user decides', async () => {
    let decide: (d: PermissionDecision) => void = () => {}
    const s = start({
      onPermission: () => new Promise((resolve) => (decide = resolve))
    })
    await listening()
    const pending = fetch(`${s.url}/permission`, {
      method: 'POST',
      body: '{"agent":"claude-code","toolName":"Bash","target":"npm test"}'
    })
    await new Promise((r) => setTimeout(r, 50))
    decide('allow')
    expect(await (await pending).json()).toEqual({ decision: 'allow' })
  })

  it('moves to the next port when 7777 is taken', async () => {
    const first = await startAgentServer(
      { onEvent: () => {}, onUsage: () => {}, onPermission: async () => null },
      { firstPort: 48777, portFile: null }
    )
    const second = await startAgentServer(
      { onEvent: () => {}, onUsage: () => {}, onPermission: async () => null },
      { firstPort: 48777, portFile: null }
    )
    expect(second.port).toBe(first.port + 1)
    first.server.close()
    second.server.close()
  })
})

describe('PermissionQueue', () => {
  const info: PermissionInfo = { agent: 'claude-code', sessionId: 's1', toolName: 'Bash' }

  it('resolves with the decision and lists what is waiting', async () => {
    const seen: number[] = []
    const queue = new PermissionQueue((prompts) => seen.push(prompts.length))
    const answer = queue.request(info)
    const [prompt] = queue.list()
    queue.decide(prompt.id, 'deny')
    expect(await answer).toBe('deny')
    expect(seen).toEqual([1, 0])
  })

  it('"answer in terminal" and timeouts mean no decision', async () => {
    const queue = new PermissionQueue(() => {}, 30)
    const viaTerminal = queue.request(info)
    queue.decide(queue.list()[0].id, 'terminal')
    expect(await viaTerminal).toBeNull()
    expect(await queue.request(info)).toBeNull() // times out after 30 ms
  })

  it('drops a session’s prompts when the agent moved on, or the hook gave up', async () => {
    const queue = new PermissionQueue(() => {})
    const answered = queue.request(info)
    queue.resolveSession('s1')
    expect(await answered).toBeNull()

    const abort = new AbortController()
    const gaveUp = queue.request(info, abort.signal)
    abort.abort()
    expect(await gaveUp).toBeNull()
    expect(queue.list()).toHaveLength(0)
  })
})
