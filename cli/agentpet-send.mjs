#!/usr/bin/env node
// AgentPet hook script. Claude Code runs it on lifecycle events and it forwards them to the app.
//
//   agentpet-send <claude-code|codex> [event]   normal hooks: forward the event, print nothing
//   agentpet-send claude-code permission        PermissionRequest hook: wait for Approve / Deny
//   agentpet-send claude-code statusline        status line: forward usage, print the status line
//
// Rules: zero dependencies, never hangs, never breaks the agent. It always exits 0, even when
// the app isn't running or the input is garbage. The only output is a permission decision the
// user made on the pet, or the status line text.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { request } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'

const STDIN_CAP_MS = 500
const POST_TIMEOUT_MS = 300
// the app gives up after 120 s and lets the agent ask in its own window
const PERMISSION_TIMEOUT_MS = 125_000
const CONFIG_DIR = join(homedir(), '.agentpet')
const DEFAULT_PORT = 7777

/** Claude Code hook name -> AgentPet event type. */
const EVENTS = {
  SessionStart: 'session_start',
  UserPromptSubmit: 'working',
  PreToolUse: 'tool',
  PostToolUse: 'tool_done',
  Notification: 'needs_you',
  Stop: 'done',
  StopFailure: 'error',
  SessionEnd: 'session_end'
}

/** Notifications that mean "come here, I need you" (not e.g. auth_success). */
const NEEDS_YOU = new Set(['permission_prompt', 'elicitation_dialog', 'agent_needs_input'])

function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('')
    let data = ''
    const done = () => resolve(data)
    setTimeout(done, STDIN_CAP_MS).unref()
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', done)
    process.stdin.on('error', done)
  })
}

/** POSTs JSON to the app. Resolves with the response body, or null on any failure. */
function post(path, body, timeoutMs) {
  const port =
    Number(process.env.AGENTPET_PORT) ||
    readJsonFile(join(CONFIG_DIR, 'server.json'))?.port ||
    DEFAULT_PORT
  return new Promise((resolve) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: { 'content-type': 'application/json' }
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => (text += chunk))
        res.on('end', () => resolve(text))
        res.on('error', () => resolve(null))
      }
    )
    req.setTimeout(timeoutMs, () => req.destroy())
    req.on('error', () => resolve(null))
    req.end(JSON.stringify(body))
  })
}

function shorten(text, max = 160) {
  if (typeof text !== 'string') return undefined
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? oneLine.slice(0, max - 1) + '…' : oneLine
}

/** The most telling bit of a tool call: the file, command, pattern or URL. */
function targetOf(input) {
  if (!input || typeof input !== 'object') return undefined
  return shorten(
    input.file_path ??
      input.notebook_path ??
      input.command ??
      input.pattern ??
      input.url ??
      input.path
  )
}

function baseFields(agent, hook) {
  return {
    agent,
    sessionId: hook.session_id,
    cwd: hook.cwd ?? hook.workspace?.current_dir,
    toolName: hook.tool_name,
    target: targetOf(hook.tool_input),
    // hooks run as children of the agent: lets the app bring its terminal / IDE to the front
    pid: process.ppid
  }
}

async function sendEvent(agent, hook, override) {
  const type = override ?? EVENTS[hook.hook_event_name]
  if (!type) return
  if (
    hook.hook_event_name === 'Notification' &&
    !override &&
    !NEEDS_YOU.has(hook.notification_type)
  ) {
    return
  }
  await post(
    '/event',
    { ...baseFields(agent, hook), type, message: shorten(hook.message), timestamp: Date.now() },
    POST_TIMEOUT_MS
  )
}

async function askPermission(agent, hook) {
  const text = await post('/permission', baseFields(agent, hook), PERMISSION_TIMEOUT_MS)
  let decision
  try {
    decision = JSON.parse(text).decision
  } catch {
    return // app not running or gave no answer
  }
  if (decision !== 'allow' && decision !== 'deny') return // let Claude Code ask as usual
  const answer =
    decision === 'allow'
      ? { behavior: 'allow' }
      : { behavior: 'deny', message: 'Denied from AgentPet.' }
  await write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: answer } })
  )
}

async function statusLine(raw, hook) {
  const limits = hook.rate_limits ?? {}
  const usage = {
    sessionId: hook.session_id,
    sessionPct: limits.five_hour?.used_percentage,
    sessionResetsAt: limits.five_hour?.resets_at,
    weekPct: limits.seven_day?.used_percentage,
    contextPct: hook.context_window?.used_percentage ?? undefined,
    costUsd: hook.cost?.total_cost_usd,
    model: hook.model?.display_name
  }
  await post('/usage', usage, POST_TIMEOUT_MS)

  // keep the user's own status line if they had one before AgentPet
  const previous = readJsonFile(join(CONFIG_DIR, 'config.json'))?.previousStatusLine?.command
  if (typeof previous === 'string' && previous) {
    const result = spawnSync(previous, { shell: true, input: raw, encoding: 'utf8', timeout: 2000 })
    return write(result.stdout ?? '')
  }

  const parts = [usage.model ?? 'AgentPet']
  if (usage.sessionPct !== undefined) parts.push(`session ${Math.round(usage.sessionPct)}%`)
  if (usage.contextPct !== undefined) parts.push(`ctx ${Math.round(usage.contextPct)}%`)
  if (usage.costUsd !== undefined) parts.push(`$${usage.costUsd.toFixed(2)}`)
  await write(`🐱 ${parts.join(' · ')}`)
}

function write(text) {
  return new Promise((resolve) => process.stdout.write(text, () => resolve()))
}

async function main() {
  const [agent = 'unknown', mode] = process.argv.slice(2)
  const raw = await readStdin()
  let hook = {}
  try {
    hook = JSON.parse(raw) ?? {}
  } catch {
    // no or broken input: still send what we can
  }
  if (mode === 'permission') return askPermission(agent, hook)
  if (mode === 'statusline') return statusLine(raw, hook)
  return sendEvent(agent, hook, mode)
}

main()
  .catch(() => {})
  .finally(() => process.exit(0))
