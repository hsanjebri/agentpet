// Shared event types, used by the main process, the renderer and the hook CLI.

export type AgentKind = 'claude-code' | 'codex' | 'cursor' | 'unknown'

export type PetEventType =
  | 'session_start'
  | 'working' // user sent a prompt
  | 'tool' // agent is using a tool (edit, bash, read…)
  | 'tool_done' // a tool finished (so any permission prompt for it was answered)
  | 'needs_you' // agent is waiting for permission / input
  | 'done' // agent finished its turn
  | 'error' // tests failed / command failed
  | 'risky' // risky action detected (.env, deleted tests, many files)
  | 'session_end'

export interface PetEvent {
  type: PetEventType
  agent: AgentKind
  sessionId?: string
  cwd?: string // project folder (show project name in bubble)
  toolName?: string // e.g. "Edit", "Bash"
  target?: string // file path or command (shortened for display)
  message?: string // e.g. permission message from the agent
  pid?: number // the agent's process, for bringing its terminal / IDE to the front
  timestamp: number
}

export const PET_EVENT_TYPES: readonly PetEventType[] = [
  'session_start',
  'working',
  'tool',
  'tool_done',
  'needs_you',
  'done',
  'error',
  'risky',
  'session_end'
]

export const AGENT_KINDS: readonly AgentKind[] = ['claude-code', 'codex', 'cursor', 'unknown']

const MAX_TEXT = 200

export function optionalText(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  return value.length > MAX_TEXT ? value.slice(0, MAX_TEXT - 1) + '…' : value
}

/** Validates untrusted input and returns a clean PetEvent, or null if it is invalid. */
export function parsePetEvent(input: unknown): PetEvent | null {
  if (typeof input !== 'object' || input === null) return null
  const raw = input as Record<string, unknown>

  if (!PET_EVENT_TYPES.includes(raw.type as PetEventType)) return null
  const agent = AGENT_KINDS.includes(raw.agent as AgentKind) ? (raw.agent as AgentKind) : 'unknown'
  const timestamp =
    typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp) ? raw.timestamp : Date.now()

  return {
    type: raw.type as PetEventType,
    agent,
    sessionId: optionalText(raw.sessionId),
    cwd: optionalText(raw.cwd),
    toolName: optionalText(raw.toolName),
    target: optionalText(raw.target),
    message: optionalText(raw.message),
    pid: optionalNumber(raw.pid, 1, 2 ** 32),
    timestamp
  }
}

function optionalNumber(value: unknown, min = 0, max = Infinity): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined
}

/** Usage numbers from the agent's status line. Every field is optional: plans differ. */
export interface UsageInfo {
  sessionId?: string
  /** % of the 5-hour limit used ("current session" in /usage); Pro/Max plans only */
  sessionPct?: number
  /** unix seconds when the 5-hour window resets */
  sessionResetsAt?: number
  /** % of the weekly limit used */
  weekPct?: number
  /** % of the context window used */
  contextPct?: number
  costUsd?: number
  model?: string
  timestamp: number
}

export function parseUsage(input: unknown): UsageInfo | null {
  if (typeof input !== 'object' || input === null) return null
  const raw = input as Record<string, unknown>
  return {
    sessionId: optionalText(raw.sessionId),
    sessionPct: optionalNumber(raw.sessionPct, 0, 1000),
    sessionResetsAt: optionalNumber(raw.sessionResetsAt),
    weekPct: optionalNumber(raw.weekPct, 0, 1000),
    contextPct: optionalNumber(raw.contextPct, 0, 100),
    costUsd: optionalNumber(raw.costUsd),
    model: optionalText(raw.model),
    timestamp: Date.now()
  }
}

/** A tool call waiting for the user's OK, shown as the approval bubble. */
export interface PermissionPrompt {
  id: string
  agent: AgentKind
  sessionId?: string
  cwd?: string
  toolName: string
  target?: string // command or file, shortened
  pid?: number
  createdAt: number
}

/** 'terminal' = let the agent ask in its own window as usual. */
export type PermissionDecision = 'allow' | 'deny' | 'terminal'

export const PERMISSION_DECISIONS: readonly PermissionDecision[] = ['allow', 'deny', 'terminal']

/** Validates a permission request from the hook (everything except the id and time). */
export function parsePermissionRequest(
  input: unknown
): Omit<PermissionPrompt, 'id' | 'createdAt'> | null {
  if (typeof input !== 'object' || input === null) return null
  const raw = input as Record<string, unknown>
  const toolName = optionalText(raw.toolName)
  if (!toolName) return null
  return {
    agent: AGENT_KINDS.includes(raw.agent as AgentKind) ? (raw.agent as AgentKind) : 'unknown',
    sessionId: optionalText(raw.sessionId),
    cwd: optionalText(raw.cwd),
    toolName,
    target: optionalText(raw.target),
    pid: optionalNumber(raw.pid, 1, 2 ** 32)
  }
}

/** What the hover bubble shows about the agent session the pet is following. */
export interface SessionSummary {
  sessionId: string
  project?: string
  lastAction?: string // e.g. "editing App.tsx"
  toolCount: number
  startedAt: number
}
