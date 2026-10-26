import { mkdtempSync, readFileSync } from 'fs'
import type { Server } from 'http'
import type { AddressInfo } from 'net'
import { tmpdir } from 'os'
import { join } from 'path'
import type { PermissionDecision, PetEvent, UsageInfo } from '@shared/events'
import { afterEach, describe, expect, it } from 'vitest'
import { PermissionQueue } from '../src/main/permissions'
import { type PermissionInfo, createAgentServer, startAgentServer } from '../src/main/server'

let server: Server | undefined

afterEach(() => {
  server?.close()
  server = undefined
})

const TOKEN = 'secret'
const noop = { onEvent: () => {}, onUsage: () => {}, onPermission: async () => null }

function start(overrides: Partial<Parameters<typeof createAgentServer>[0]> = {}): {
  url: string
  events: PetEvent[]
  usage: UsageInfo[]
} {
  const events: PetEvent[] = []
  const usage: UsageInfo[] = []
  server = createAgentServer(
    {
      onEvent: (e) => events.push(e),
      onUsage: (u) => usage.push(u),
      onPermission: async () => null,
      ...overrides
    },
    { token: TOKEN, findAgentPid: async () => null }
  )
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

/** What the curl hooks send. */
function hook(
  url: string,
  mode: string,
  body: string,
  headers: Record<string, string> = {}
): Promise<Response> {
  return fetch(`${url}/hook`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'x-agentpet-hook': mode, ...headers },
    body
  })
}

describe('event server', () => {
  it('answers /health', async () => {
    const s = start()
    await listening()
    expect(await (await fetch(`${s.url}/health`)).json()).toEqual({ ok: true, app: 'agentpet' })
  })

  it('turns a raw Claude Code hook into a pet event', async () => {
    const s = start()
    await listening()
    const res = await hook(
      s.url,
      'event',
      '{"hook_event_name":"Notification","notification_type":"permission_prompt","session_id":"s1"}'
    )
    expect(res.status).toBe(204)
    expect(s.events[0]).toMatchObject({ type: 'needs_you', agent: 'claude-code', sessionId: 's1' })
  })

  it('needs the token', async () => {
    const s = start()
    await listening()
    const body = '{"hook_event_name":"Stop"}'
    expect((await hook(s.url, 'event', body, { authorization: 'Bearer nope' })).status).toBe(401)
    expect((await hook(s.url, 'event', body, { authorization: '' })).status).toBe(401)
    expect(s.events).toHaveLength(0)
  })

  it('rejects bad input, unknown routes and huge bodies', async () => {
    const s = start()
    await listening()
    const status = (mode: string, body: string): Promise<number> =>
      hook(s.url, mode, body).then((r) => r.status)
    expect(await status('event', 'not json')).toBe(400)
    expect(await status('explode', '{}')).toBe(400)
    expect(await status('permission', '{}')).toBe(400) // no tool
    expect((await fetch(`${s.url}/event`, { method: 'POST', body: '{}' })).status).toBe(404)
    expect(await status('event', JSON.stringify({ pad: 'x'.repeat(70_000) }))).toBe(413)
    expect(s.events).toHaveLength(0)
  })

  it('rejects requests from web pages (Origin header)', async () => {
    const s = start()
    await listening()
    const res = await hook(s.url, 'event', '{"hook_event_name":"Stop"}', {
      origin: 'https://evil.example'
    })
    expect(res.status).toBe(403)
    expect(s.events).toHaveLength(0)
  })

  it('forwards usage from the status line', async () => {
    const s = start()
    await listening()
    const res = await hook(
      s.url,
      'statusline',
      '{"rate_limits":{"five_hour":{"used_percentage":42}},"context_window":{"used_percentage":7}}'
    )
    expect(await res.text()).toBe('🐱 AgentPet · session 42% · ctx 7%')
    expect(s.usage[0]).toMatchObject({ sessionPct: 42, contextPct: 7 })
  })

  it('holds a permission request until the user decides', async () => {
    let decide: (d: PermissionDecision) => void = () => {}
    const s = start({
      onPermission: () => new Promise((resolve) => (decide = resolve))
    })
    await listening()
    const pending = hook(
      s.url,
      'permission',
      '{"tool_name":"Bash","tool_input":{"command":"npm test"}}'
    )
    await new Promise((r) => setTimeout(r, 50))
    decide('allow')
    expect(await (await pending).json()).toEqual({
      hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } }
    })
  })

  it('moves to the next port when 7777 is taken, and writes the curl config', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agentpet-server-'))
    const curlConfigFile = join(dir, 'agentpet-send.curl')
    const first = await startAgentServer(noop, {
      firstPort: 48777,
      portFile: null,
      curlConfigFile
    })
    const second = await startAgentServer(noop, {
      firstPort: 48777,
      portFile: null,
      curlConfigFile: null
    })
    expect(second.port).toBe(first.port + 1)
    const config = readFileSync(curlConfigFile, 'utf8')
    expect(config).toContain(`url = "http://127.0.0.1:${first.port}/hook"`)
    expect(config).toContain(`header = "Authorization: Bearer ${first.token}"`)
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
