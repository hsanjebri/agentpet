// Shared event types, used by the main process, the renderer and the hook CLI.

export type AgentKind = 'claude-code' | 'codex' | 'cursor' | 'unknown'

export type PetEventType =
  | 'session_start'
  | 'working' // user sent a prompt
  | 'tool' // agent is using a tool (edit, bash, read…)
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
  timestamp: number
}

export const PET_EVENT_TYPES: readonly PetEventType[] = [
  'session_start',
  'working',
  'tool',
  'needs_you',
  'done',
  'error',
  'risky',
  'session_end'
]

export const AGENT_KINDS: readonly AgentKind[] = ['claude-code', 'codex', 'cursor', 'unknown']

const MAX_TEXT = 200

function optionalText(value: unknown): string | undefined {
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
    timestamp
  }
}
