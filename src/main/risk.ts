// Spots risky agent actions (secrets, destructive commands, deleted tests, huge edits) so the
// pet can hiss. Runs on every tool event; only looks at the short display strings we receive.
import type { PetEvent } from '../shared/events'
import type { RiskKind } from '../shared/settings'

/** More distinct files than this edited in one turn is worth a look. */
export const MANY_FILES = 25

// a file name starts after a path separator, a space or a quote (paths and commands)
const SECRET_FILE = [
  /(^|[\\/\s"'])\.env(\.|$|[\s"'])/i,
  /secret/i,
  /\.pem($|[\s"'])/i,
  /(^|[\\/\s"'])id_rsa/i
]

const DANGEROUS_COMMANDS: Array<[RegExp, string, RiskKind]> = [
  [/\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i, 'rm -rf', 'rm_rf'],
  [/\bgit\s+push\b.*(--force\b|\s-f\b)/i, 'git push --force', 'force_push'],
  [/\bdrop\s+table\b/i, 'DROP TABLE', 'drop_table'],
  [/\bchmod\s+(-R\s+)?777\b/i, 'chmod 777', 'chmod_777']
]

const TEST_FILE =
  /(\.test\.|\.spec\.|_test\.|(^|[\\/\s])test_[^\\/\s]*\.py|[\\/]__tests__[\\/]|(^|[\\/\s])tests?[\\/])/i
const DELETE_COMMAND = /\b(rm|del|git\s+rm|Remove-Item)\b/i

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit'])
const SHELL_TOOLS = new Set(['Bash', 'PowerShell'])

function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

interface Risk {
  kind: RiskKind
  reason: string
}

function findRisk(toolName?: string, target?: string): Risk | null {
  if (!toolName || !target) return null
  if (EDIT_TOOLS.has(toolName) && SECRET_FILE.some((p) => p.test(target))) {
    return { kind: 'secrets', reason: `touching ${fileName(target)}` }
  }
  if (SHELL_TOOLS.has(toolName)) {
    for (const [pattern, reason, kind] of DANGEROUS_COMMANDS)
      if (pattern.test(target)) return { kind, reason }
    if (DELETE_COMMAND.test(target) && TEST_FILE.test(target))
      return { kind: 'deleted_tests', reason: 'deleting tests' }
    if (
      SECRET_FILE.some((p) => p.test(target)) &&
      /\b(cat|type|Get-Content|cp|mv)\b/i.test(target)
    ) {
      return { kind: 'secrets', reason: 'reading secrets' }
    }
  }
  return null
}

/** Why a single tool call looks risky, or null. */
export function riskOf(toolName?: string, target?: string): string | null {
  return findRisk(toolName, target)?.reason ?? null
}

/** Settings › Claude Code › Risk warnings: which kinds to warn about, what never to. */
export interface RiskOptions {
  enabled?: Partial<Record<RiskKind, boolean>>
  /** substrings of paths / commands to ignore */
  allow?: readonly string[]
}

function allowed(target: string | undefined, allow: readonly string[] = []): boolean {
  if (!target) return false
  const t = target.toLowerCase()
  return allow.some((a) => a && t.includes(a.toLowerCase()))
}

/** Remembers the files each session edits in the current turn (resets on a new prompt). */
export class RiskWatcher {
  private turnFiles = new Map<string, Set<string>>()
  private warnedMany = new Set<string>()

  /** Returns the reason this event is risky, or null. */
  check(event: PetEvent, { enabled = {}, allow = [] }: RiskOptions = {}): string | null {
    const on = (kind: RiskKind): boolean => enabled[kind] !== false
    const session = event.sessionId ?? '?'
    if (event.type === 'working' || event.type === 'session_end') {
      this.turnFiles.delete(session)
      this.warnedMany.delete(session)
      return null
    }
    if (event.type !== 'tool') return null

    if (allowed(event.target, allow)) return null
    const single = findRisk(event.toolName, event.target)
    if (single) return on(single.kind) ? single.reason : null

    if (event.toolName && EDIT_TOOLS.has(event.toolName) && event.target) {
      const files = this.turnFiles.get(session) ?? new Set<string>()
      files.add(event.target)
      this.turnFiles.set(session, files)
      if (files.size > MANY_FILES && !this.warnedMany.has(session) && on('many_files')) {
        this.warnedMany.add(session)
        return `${files.size} files changed in one go`
      }
    }
    return null
  }
}
