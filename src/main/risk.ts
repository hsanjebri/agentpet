// Spots risky agent actions (secrets, destructive commands, deleted tests, huge edits) so the
// pet can hiss. Runs on every tool event; only looks at the short display strings we receive.
import type { PetEvent } from '../shared/events'

/** More distinct files than this edited in one turn is worth a look. */
export const MANY_FILES = 25

// a file name starts after a path separator, a space or a quote (paths and commands)
const SECRET_FILE = [
  /(^|[\\/\s"'])\.env(\.|$|[\s"'])/i,
  /secret/i,
  /\.pem($|[\s"'])/i,
  /(^|[\\/\s"'])id_rsa/i
]

const DANGEROUS_COMMANDS: Array<[RegExp, string]> = [
  [/\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i, 'rm -rf'],
  [/\bgit\s+push\b.*(--force\b|\s-f\b)/i, 'git push --force'],
  [/\bdrop\s+table\b/i, 'DROP TABLE'],
  [/\bchmod\s+(-R\s+)?777\b/i, 'chmod 777']
]

const TEST_FILE =
  /(\.test\.|\.spec\.|_test\.|(^|[\\/\s])test_[^\\/\s]*\.py|[\\/]__tests__[\\/]|(^|[\\/\s])tests?[\\/])/i
const DELETE_COMMAND = /\b(rm|del|git\s+rm|Remove-Item)\b/i

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit'])
const SHELL_TOOLS = new Set(['Bash', 'PowerShell'])

function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

/** Why a single tool call looks risky, or null. */
export function riskOf(toolName?: string, target?: string): string | null {
  if (!toolName || !target) return null
  if (EDIT_TOOLS.has(toolName) && SECRET_FILE.some((p) => p.test(target))) {
    return `touching ${fileName(target)}`
  }
  if (SHELL_TOOLS.has(toolName)) {
    for (const [pattern, label] of DANGEROUS_COMMANDS) if (pattern.test(target)) return label
    if (DELETE_COMMAND.test(target) && TEST_FILE.test(target)) return 'deleting tests'
    if (
      SECRET_FILE.some((p) => p.test(target)) &&
      /\b(cat|type|Get-Content|cp|mv)\b/i.test(target)
    ) {
      return 'reading secrets'
    }
  }
  return null
}

/** Remembers the files each session edits in the current turn (resets on a new prompt). */
export class RiskWatcher {
  private turnFiles = new Map<string, Set<string>>()
  private warnedMany = new Set<string>()

  /** Returns the reason this event is risky, or null. */
  check(event: PetEvent): string | null {
    const session = event.sessionId ?? '?'
    if (event.type === 'working' || event.type === 'session_end') {
      this.turnFiles.delete(session)
      this.warnedMany.delete(session)
      return null
    }
    if (event.type !== 'tool') return null

    const single = riskOf(event.toolName, event.target)
    if (single) return single

    if (event.toolName && EDIT_TOOLS.has(event.toolName) && event.target) {
      const files = this.turnFiles.get(session) ?? new Set<string>()
      files.add(event.target)
      this.turnFiles.set(session, files)
      if (files.size > MANY_FILES && !this.warnedMany.has(session)) {
        this.warnedMany.add(session)
        return `${files.size} files changed in one go`
      }
    }
    return null
  }
}
