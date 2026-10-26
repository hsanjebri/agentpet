// Tracks active agent sessions: what they're doing (for the hover bubble) and which process
// they run in (for bringing their terminal to the front).
import type { PetEvent, SessionSummary } from '../shared/events'

/** Sessions quiet for this long are forgotten (e.g. the terminal was closed without SessionEnd). */
const STALE_MS = 60 * 60_000

interface Session extends SessionSummary {
  pid?: number
  lastEventAt: number
}

function fileName(path?: string): string | undefined {
  return path?.split(/[\\/]/).filter(Boolean).pop()
}

/** Turns a tool call into a few friendly words for the hover bubble. */
export function describeAction(toolName?: string, target?: string): string | undefined {
  switch (toolName) {
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return `editing ${fileName(target) ?? 'a file'}`
    case 'Read':
      return `reading ${fileName(target) ?? 'a file'}`
    case 'Bash':
    case 'PowerShell': {
      const command = target?.split(' ').slice(0, 3).join(' ')
      return command ? `running ${command}` : 'running a command'
    }
    case 'Grep':
    case 'Glob':
      return 'searching the code'
    case 'WebFetch':
    case 'WebSearch':
      return 'browsing the web'
    case 'Task':
    case 'Agent':
      return 'delegating to a subagent'
    case undefined:
      return undefined
    default:
      return `using ${toolName}`
  }
}

export class SessionTracker {
  private sessions = new Map<string, Session>()

  update(event: PetEvent, now = Date.now()): void {
    for (const [id, s] of this.sessions)
      if (now - s.lastEventAt > STALE_MS) this.sessions.delete(id)
    if (!event.sessionId) return
    if (event.type === 'session_end') {
      this.sessions.delete(event.sessionId)
      return
    }

    const session = this.sessions.get(event.sessionId) ?? {
      sessionId: event.sessionId,
      toolCount: 0,
      startedAt: now,
      lastEventAt: now
    }
    session.lastEventAt = now
    if (event.pid) session.pid = event.pid
    if (event.cwd) session.project = fileName(event.cwd)
    if (event.type === 'tool') {
      session.toolCount++
      session.lastAction = describeAction(event.toolName, event.target) ?? session.lastAction
    }
    this.sessions.set(event.sessionId, session)
  }

  /** The most recently active session (or the given one) */
  private pick(sessionId?: string): Session | undefined {
    if (sessionId && this.sessions.has(sessionId)) return this.sessions.get(sessionId)
    return [...this.sessions.values()].sort((a, b) => b.lastEventAt - a.lastEventAt)[0]
  }

  pidFor(sessionId?: string): number | undefined {
    return this.pick(sessionId)?.pid
  }

  /** True when the session is tracked but its process isn't known yet. */
  needsPid(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    return Boolean(session && !session.pid)
  }

  setPid(sessionId: string, pid: number): void {
    const session = this.sessions.get(sessionId)
    if (session) session.pid = pid
  }

  latest(): SessionSummary | null {
    const s = this.pick()
    if (!s) return null
    const { sessionId, project, lastAction, toolCount, startedAt } = s
    return { sessionId, project, lastAction, toolCount, startedAt }
  }
}
