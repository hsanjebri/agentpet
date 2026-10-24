// Permission requests waiting for the user to click Approve / Deny on the pet.
import { randomUUID } from 'crypto'
import type { PermissionDecision, PermissionPrompt } from '../shared/events'
import type { PermissionInfo } from './server'

/** How long a request waits for a click before the agent asks in its own window instead. */
export const PERMISSION_WAIT_MS = 120_000

interface Pending {
  prompt: PermissionPrompt
  finish(decision: PermissionDecision | null): void
}

export class PermissionQueue {
  private pending = new Map<string, Pending>()

  constructor(
    private onChange: (prompts: PermissionPrompt[]) => void,
    private waitMs = PERMISSION_WAIT_MS
  ) {}

  /** Resolves with 'allow' / 'deny', or null when the agent should ask in its own window. */
  request(info: PermissionInfo, cancelled?: AbortSignal): Promise<PermissionDecision | null> {
    const prompt: PermissionPrompt = { ...info, id: randomUUID(), createdAt: Date.now() }
    return new Promise((resolve) => {
      const finish = (decision: PermissionDecision | null): void => {
        if (!this.pending.delete(prompt.id)) return
        clearTimeout(timer)
        resolve(decision === 'terminal' ? null : decision)
        this.onChange(this.list())
      }
      const timer = setTimeout(() => finish(null), this.waitMs)
      cancelled?.addEventListener('abort', () => finish(null))
      this.pending.set(prompt.id, { prompt, finish })
      this.onChange(this.list())
    })
  }

  decide(id: string, decision: PermissionDecision): PermissionPrompt | undefined {
    const pending = this.pending.get(id)
    pending?.finish(decision)
    return pending?.prompt
  }

  /** The agent moved on (tool finished, turn over…), so its prompts were answered elsewhere. */
  resolveSession(sessionId: string): void {
    for (const { prompt, finish } of [...this.pending.values()]) {
      if (prompt.sessionId === sessionId) finish(null)
    }
  }

  /** Lets every waiting hook go, e.g. when the app quits. */
  clear(): void {
    for (const { finish } of [...this.pending.values()]) finish(null)
  }

  list(): PermissionPrompt[] {
    return [...this.pending.values()].map((p) => p.prompt)
  }
}
