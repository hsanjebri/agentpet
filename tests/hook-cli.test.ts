// The hook script must never block or break the agent, app running or not.
import { spawn } from 'child_process'
import { type Server, createServer } from 'http'
import type { AddressInfo } from 'net'
import { resolve } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { addAgentPet, removeAgentPet } from '../scripts/claude-hooks.mjs'

const CLI = resolve(__dirname, '../cli/agentpet-send.mjs')

function runCli(
  args: string[],
  stdin: string,
  port: number
): Promise<{ code: number | null; stdout: string; ms: number }> {
  return new Promise((done) => {
    const started = Date.now()
    const child = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, AGENTPET_PORT: String(port) }
    })
    let stdout = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.on('close', (code) => done({ code, stdout, ms: Date.now() - started }))
    child.stdin.end(stdin)
  })
}

let server: Server | undefined
afterEach(() => server?.close())

/** A fake AgentPet that records requests and answers /permission with `decision`. */
function fakeApp(decision: string | null = null): Promise<{ port: number; bodies: unknown[] }> {
  const bodies: unknown[] = []
  server = createServer((req, res) => {
    let text = ''
    req.on('data', (c) => (text += c))
    req.on('end', () => {
      bodies.push({ path: req.url, ...JSON.parse(text) })
      if (req.url === '/permission') res.end(JSON.stringify({ decision }))
      else res.writeHead(204).end()
    })
  })
  return new Promise((r) =>
    server!.listen(0, '127.0.0.1', () =>
      r({ port: (server!.address() as AddressInfo).port, bodies })
    )
  )
}

const PRE_TOOL = JSON.stringify({
  session_id: 's1',
  cwd: '/p',
  hook_event_name: 'PreToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'npm test' }
})

describe('agentpet-send', () => {
  it('with the app closed: exits 0 at once and prints nothing', async () => {
    for (const args of [['claude-code'], ['claude-code', 'permission']]) {
      const result = await runCli(args, PRE_TOOL, 9) // nothing listens on port 9
      expect(result).toMatchObject({ code: 0, stdout: '' })
      expect(result.ms).toBeLessThan(3000)
    }
  })

  it('survives garbage input', async () => {
    expect(await runCli(['claude-code'], 'not json {', 9)).toMatchObject({ code: 0, stdout: '' })
  })

  it('forwards a hook as a pet event', async () => {
    const app = await fakeApp()
    const result = await runCli(['claude-code'], PRE_TOOL, app.port)
    expect(result).toMatchObject({ code: 0, stdout: '' })
    expect(app.bodies[0]).toMatchObject({
      path: '/event',
      type: 'tool',
      sessionId: 's1',
      toolName: 'Bash',
      target: 'npm test'
    })
  })

  it('ignores notifications that do not need the user', async () => {
    const app = await fakeApp()
    const hook = { hook_event_name: 'Notification', notification_type: 'auth_success' }
    await runCli(['claude-code'], JSON.stringify(hook), app.port)
    expect(app.bodies).toHaveLength(0)
  })

  it.each([
    ['allow', { behavior: 'allow' }],
    ['deny', { behavior: 'deny', message: 'Denied from AgentPet.' }]
  ])('permission: prints the %s decision Claude Code expects', async (decision, expected) => {
    const app = await fakeApp(decision)
    const result = await runCli(['claude-code', 'permission'], PRE_TOOL, app.port)
    expect(JSON.parse(result.stdout)).toEqual({
      hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: expected }
    })
  })

  it('permission: no decision (answer in terminal) prints nothing', async () => {
    const app = await fakeApp(null)
    expect(await runCli(['claude-code', 'permission'], PRE_TOOL, app.port)).toMatchObject({
      code: 0,
      stdout: ''
    })
  })

  it('statusline: forwards usage and prints a status line', async () => {
    const app = await fakeApp()
    const status = {
      session_id: 's1',
      model: { display_name: 'Opus' },
      context_window: { used_percentage: 41 },
      cost: { total_cost_usd: 1.2 },
      rate_limits: { five_hour: { used_percentage: 23.4, resets_at: 1738425600 } }
    }
    const result = await runCli(['claude-code', 'statusline'], JSON.stringify(status), app.port)
    expect(app.bodies[0]).toMatchObject({ path: '/usage', sessionPct: 23.4, contextPct: 41 })
    expect(result.stdout).toBe('🐱 Opus · session 23% · ctx 41% · $1.20')
  })
})

describe('Claude Code settings merge', () => {
  const userHook = { matcher: 'Bash', hooks: [{ type: 'command', command: 'my-own-check.sh' }] }

  it('adds our hooks next to the user’s, and only once', () => {
    const once = addAgentPet(
      { theme: 'dark', hooks: { PreToolUse: [userHook] } },
      '/x/agentpet-send.mjs'
    )
    const twice = addAgentPet(once, '/x/agentpet-send.mjs')
    expect(twice).toEqual(once)
    const pre = (once.hooks as Record<string, unknown[]>).PreToolUse
    expect(pre).toHaveLength(2)
    expect(pre[0]).toEqual(userHook)
    expect(once.theme).toBe('dark')
    expect(once.statusLine).toMatchObject({ type: 'command' })
  })

  it('removes only our entries', () => {
    const original = { theme: 'dark', hooks: { PreToolUse: [userHook] } }
    expect(removeAgentPet(addAgentPet(original, '/x/agentpet-send.mjs'))).toEqual(original)
    expect(removeAgentPet(addAgentPet({}, '/x/agentpet-send.mjs'))).toEqual({})
  })
})

describe('hook entries', () => {
  it('use the shape Claude Code expects: each event is a list of matcher groups', async () => {
    const { agentPetEntries } = await import('../scripts/claude-hooks.mjs')
    for (const groups of Object.values(agentPetEntries('/x/agentpet-send.mjs').hooks)) {
      expect(Array.isArray(groups)).toBe(true)
      for (const g of groups as Array<{ hooks: unknown[] }>)
        expect(Array.isArray(g.hooks)).toBe(true)
    }
  })
})
