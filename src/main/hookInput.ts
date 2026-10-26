// Turns what Claude Code sends its hooks (raw JSON on stdin, POSTed as is by curl) into pet
// events, permission requests and usage. Pure, so it is easy to test.
import {
  type AgentKind,
  type PetEvent,
  type PetEventType,
  type UsageInfo,
  parsePermissionRequest,
  parsePetEvent,
  parseUsage
} from '../shared/events'
import type { PermissionInfo } from './server'

export type HookMode = 'event' | 'permission' | 'statusline'

export const HOOK_MODES: readonly HookMode[] = ['event', 'permission', 'statusline']

/** Claude Code hook name -> AgentPet event type. */
const EVENTS: Record<string, PetEventType> = {
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

type Hook = Record<string, unknown>

function asObject(value: unknown): Hook {
  return typeof value === 'object' && value !== null ? (value as Hook) : {}
}

function shorten(text: unknown, max = 160): string | undefined {
  if (typeof text !== 'string') return undefined
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? oneLine.slice(0, max - 1) + '…' : oneLine
}

/** The most telling bit of a tool call: the file, command, pattern or URL. */
function targetOf(input: unknown): string | undefined {
  const i = asObject(input)
  return shorten(i.file_path ?? i.notebook_path ?? i.command ?? i.pattern ?? i.url ?? i.path)
}

function baseFields(agent: AgentKind, hook: Hook): Hook {
  return {
    agent,
    sessionId: hook.session_id,
    cwd: hook.cwd ?? asObject(hook.workspace).current_dir,
    toolName: hook.tool_name,
    target: targetOf(hook.tool_input)
  }
}

/** A hook as a pet event, or null for hooks the pet doesn't care about. */
export function eventFromHook(agent: AgentKind, input: unknown): PetEvent | null {
  const hook = asObject(input)
  const name = hook.hook_event_name
  if (typeof name !== 'string') return null
  const type = EVENTS[name]
  if (!type) return null
  if (name === 'Notification' && !NEEDS_YOU.has(hook.notification_type as string)) return null
  return parsePetEvent({
    ...baseFields(agent, hook),
    type,
    message: shorten(hook.message),
    timestamp: Date.now()
  })
}

/** A PermissionRequest hook as an approval bubble (null when it names no tool). */
export function permissionFromHook(agent: AgentKind, input: unknown): PermissionInfo | null {
  return parsePermissionRequest(baseFields(agent, asObject(input)))
}

/** The answer Claude Code expects on stdout; nothing at all lets it ask in the terminal. */
export function permissionOutput(decision: string | null): string {
  if (decision !== 'allow' && decision !== 'deny') return ''
  const answer =
    decision === 'allow'
      ? { behavior: 'allow' }
      : { behavior: 'deny', message: 'Denied from AgentPet.' }
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: answer }
  })
}

/** Usage numbers from the status line input. */
export function usageFromStatusLine(input: unknown): UsageInfo {
  const hook = asObject(input)
  const limits = asObject(hook.rate_limits)
  const fiveHour = asObject(limits.five_hour)
  return parseUsage({
    sessionId: hook.session_id,
    sessionPct: fiveHour.used_percentage,
    sessionResetsAt: fiveHour.resets_at,
    weekPct: asObject(limits.seven_day).used_percentage,
    contextPct: asObject(hook.context_window).used_percentage,
    costUsd: asObject(hook.cost).total_cost_usd,
    model: asObject(hook.model).display_name
  }) as UsageInfo
}

/** AgentPet's own status line, for users who didn't have one before. */
export function statusLineText(usage: UsageInfo): string {
  const parts = [usage.model ?? 'AgentPet']
  if (usage.sessionPct !== undefined) parts.push(`session ${Math.round(usage.sessionPct)}%`)
  if (usage.contextPct !== undefined) parts.push(`ctx ${Math.round(usage.contextPct)}%`)
  if (usage.costUsd !== undefined) parts.push(`$${usage.costUsd.toFixed(2)}`)
  return `🐱 ${parts.join(' · ')}`
}
