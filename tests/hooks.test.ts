// The hooks are the exact curl commands written to Claude Code's settings, run against the real
// server. They must never block or break the agent, app running or not.
import { spawn } from 'child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import type { Server } from 'http'
import type { AddressInfo } from 'net'
import { tmpdir } from 'os'
import { join } from 'path'
import type { PermissionDecision, PetEvent, UsageInfo } from '@shared/events'
import { afterEach, describe, expect, it } from 'vitest'
import {
  addAgentPet,
  agentPetEntries,
  hasAgentPet,
  isCurrent,
  removeAgentPet
} from '../scripts/claude-hooks.mjs'
import { connect, upgrade } from '../scripts/claude-settings.mjs'
import { type ServerHandlers, createAgentServer, curlConfig } from '../src/main/server'

const TOKEN = 'test-token'
const dir = mkdtempSync(join(tmpdir(), 'agentpet-hooks-'))
const CONF = join(dir, 'agentpet-send.curl')

type Mode = 'event' | 'permission' | 'statusline'

/** The hook command from settings.json for this mode (exec form: command + args). */
function hookCommand(mode: Mode): { command: string; args: string[] } {
  const { hooks } = agentPetEntries(CONF)
  const first = (event: string): { command: string; args: string[] } =>
    (hooks[event] as Array<{ hooks: Array<{ command: string; args: string[] }> }>)[0].hooks[0]
  if (mode === 'event') return first('PreToolUse')
  if (mode === 'permission') return first('PermissionRequest')
  // the status line is a shell string (tested below); run the same curl call without a shell
  const { command, args } = first('PreToolUse')
  return { command, args: args.map((a) => a.replace(': event', ': statusline')) }
}

function runHook(
  mode: Mode,
  stdin: string
): Promise<{ code: number | null; stdout: string; ms: number }> {
  const { command, args } = hookCommand(mode)
  return new Promise((done) => {
    const started = Date.now()
    const child = spawn(command, args)
    let stdout = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.on('close', (code) => done({ code, stdout, ms: Date.now() - started }))
    child.stdin.end(stdin)
  })
}

let server: Server | undefined
afterEach(() => server?.close())

/** The real server, with recording handlers, and the curl config pointing at it. */
function startApp(
  decision: PermissionDecision | null = null,
  token = TOKEN
): Promise<{ events: PetEvent[]; usage: UsageInfo[]; pids: number[] }> {
  const events: PetEvent[] = []
  const usage: UsageInfo[] = []
  const pids: number[] = []
  const handlers: ServerHandlers = {
    onEvent: (e) => events.push(e),
    onUsage: (u) => usage.push(u),
    onPermission: async () => decision,
    wantsPid: () => pids.length === 0,
    onAgentPid: (_, pid) => pids.push(pid)
  }
  server = createAgentServer(handlers, { token: TOKEN, findAgentPid: async () => 4242 })
  return new Promise((r) =>
    server!.listen(0, '127.0.0.1', () => {
      writeFileSync(CONF, curlConfig((server!.address() as AddressInfo).port, token))
      r({ events, usage, pids })
    })
  )
}

const PRE_TOOL = JSON.stringify({
  session_id: 's1',
  cwd: '/p',
  hook_event_name: 'PreToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'npm test' }
})

describe('curl hooks', () => {
  it('with the app closed: fails fast and quietly (never exit 2, nothing printed)', async () => {
    writeFileSync(CONF, curlConfig(9, TOKEN)) // nothing listens on port 9
    for (const mode of ['event', 'permission', 'statusline'] as const) {
      const result = await runHook(mode, PRE_TOOL)
      expect(result.stdout).toBe('')
      expect(result.code).not.toBe(2)
      expect(result.ms).toBeLessThan(3000)
    }
  })

  it('forwards a hook as a pet event and learns the agent process', async () => {
    const app = await startApp()
    expect(await runHook('event', PRE_TOOL)).toMatchObject({ code: 0, stdout: '' })
    expect(app.events[0]).toMatchObject({
      type: 'tool',
      agent: 'claude-code',
      sessionId: 's1',
      cwd: '/p',
      toolName: 'Bash',
      target: 'npm test'
    })
    expect(app.pids).toEqual([4242])
  })

  it('ignores notifications that do not need the user, and garbage', async () => {
    const app = await startApp()
    const hook = { hook_event_name: 'Notification', notification_type: 'auth_success' }
    expect(await runHook('event', JSON.stringify(hook))).toMatchObject({ code: 0, stdout: '' })
    expect((await runHook('event', 'not json {')).stdout).toBe('')
    expect(app.events).toHaveLength(0)
  })

  it('a wrong token is refused quietly', async () => {
    const app = await startApp('allow', 'wrong-token')
    const result = await runHook('permission', PRE_TOOL)
    expect(result.stdout).toBe('')
    expect(result.code).not.toBe(0)
    expect(app.events).toHaveLength(0)
  })

  it.each([
    ['allow', { behavior: 'allow' }],
    ['deny', { behavior: 'deny', message: 'Denied from AgentPet.' }]
  ] as const)(
    'permission: prints the %s decision Claude Code expects',
    async (decision, expected) => {
      await startApp(decision)
      const result = await runHook('permission', PRE_TOOL)
      expect(result.code).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({
        hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: expected }
      })
    }
  )

  it('permission: no decision (answer in terminal) prints nothing', async () => {
    await startApp(null)
    expect(await runHook('permission', PRE_TOOL)).toMatchObject({ code: 0, stdout: '' })
  })

  it('statusline: forwards usage and prints a status line', async () => {
    const app = await startApp()
    const status = {
      session_id: 's1',
      model: { display_name: 'Opus' },
      context_window: { used_percentage: 41 },
      cost: { total_cost_usd: 1.2 },
      rate_limits: { five_hour: { used_percentage: 23.4, resets_at: 1738425600 } }
    }
    const result = await runHook('statusline', JSON.stringify(status))
    expect(app.usage[0]).toMatchObject({ sessionPct: 23.4, contextPct: 41, model: 'Opus' })
    expect(result.stdout).toBe('🐱 Opus · session 23% · ctx 41% · $1.20')
  })
})

describe('Claude Code settings merge', () => {
  const userHook = { matcher: 'Bash', hooks: [{ type: 'command', command: 'my-own-check.sh' }] }

  it('adds our hooks next to the user’s, and only once', () => {
    const once = addAgentPet({ theme: 'dark', hooks: { PreToolUse: [userHook] } }, CONF)
    const twice = addAgentPet(once, CONF)
    expect(twice).toEqual(once)
    const pre = (once.hooks as Record<string, unknown[]>).PreToolUse
    expect(pre).toHaveLength(2)
    expect(pre[0]).toEqual(userHook)
    expect(once.theme).toBe('dark')
    expect(once.statusLine).toMatchObject({ type: 'command' })
    expect(isCurrent(once, CONF)).toBe(true)
  })

  it('removes only our entries', () => {
    const original = { theme: 'dark', hooks: { PreToolUse: [userHook] } }
    expect(removeAgentPet(addAgentPet(original, CONF))).toEqual(original)
    expect(removeAgentPet(addAgentPet({}, CONF))).toEqual({})
  })

  it('each event is a list of matcher groups; no Node anywhere', () => {
    const entries = agentPetEntries(CONF)
    for (const groups of Object.values(entries.hooks)) {
      expect(Array.isArray(groups)).toBe(true)
      for (const g of groups as Array<{ hooks: Array<{ command: string }> }>) {
        expect(Array.isArray(g.hooks)).toBe(true)
        expect(g.hooks[0].command).toMatch(/^curl(\.exe)?$/)
      }
    }
    expect(entries.statusLine.command).not.toMatch(/\bnode\b/)
  })

  it('uses curl.exe on Windows (plain "curl" is Invoke-WebRequest in PowerShell)', () => {
    const win = agentPetEntries('C:\\Users\\me\\.agentpet\\agentpet-send.curl', 'win32')
    expect(win.statusLine.command).toBe(
      'curl.exe -K "C:/Users/me/.agentpet/agentpet-send.curl" -H "X-AgentPet-Hook: statusline" -m "3" --data-binary "@-"'
    )
    expect(agentPetEntries('/h/.agentpet/agentpet-send.curl', 'darwin').statusLine.command).toMatch(
      /^curl -K /
    )
  })
})

describe('upgrading an older install', () => {
  /** What 0.4.0 wrote: hooks that run the Node script. */
  const OLD_NODE_INSTALL = {
    theme: 'dark',
    hooks: {
      PreToolUse: [
        {
          matcher: '*',
          hooks: [
            {
              type: 'command',
              command: 'node',
              args: ['/app/cli/agentpet-send.mjs', 'claude-code'],
              async: true
            }
          ]
        }
      ]
    },
    statusLine: {
      type: 'command',
      command: 'node "/app/cli/agentpet-send.mjs" claude-code statusline'
    }
  }

  it('switches the Node hooks to curl, with a backup, keeping the user’s status line', () => {
    const settingsPath = join(dir, 'settings.json')
    const configPath = join(dir, 'config.json')
    writeFileSync(settingsPath, JSON.stringify(OLD_NODE_INSTALL))
    writeFileSync(
      configPath,
      JSON.stringify({ previousStatusLine: { type: 'command', command: 'mine.sh' } })
    )

    const first = upgrade(CONF, { settingsPath, configPath })
    expect(first.upgraded).toBe(true)
    expect(first.backupPath).toBeTruthy()
    const next = JSON.parse(readFileSync(settingsPath, 'utf8'))
    expect(JSON.stringify(next)).not.toContain('agentpet-send.mjs')
    expect(isCurrent(next, CONF)).toBe(true)
    expect(next.theme).toBe('dark')
    expect(JSON.parse(readFileSync(configPath, 'utf8')).previousStatusLine.command).toBe('mine.sh')

    // already current: no rewrite, no new backup
    expect(upgrade(CONF, { settingsPath, configPath }).upgraded).toBe(false)
  })

  it('leaves users who never connected alone', () => {
    const settingsPath = join(dir, 'never.json')
    writeFileSync(settingsPath, JSON.stringify({ theme: 'dark' }))
    expect(upgrade(CONF, { settingsPath, configPath: join(dir, 'c2.json') }).upgraded).toBe(false)
    expect(hasAgentPet(JSON.parse(readFileSync(settingsPath, 'utf8')))).toBe(false)
  })

  it('connect() still works on a fresh file', () => {
    const settingsPath = join(dir, 'fresh.json')
    connect(CONF, { settingsPath, configPath: join(dir, 'c3.json') })
    expect(isCurrent(JSON.parse(readFileSync(settingsPath, 'utf8')), CONF)).toBe(true)
  })
})
