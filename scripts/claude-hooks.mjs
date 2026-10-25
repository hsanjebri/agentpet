// Pure helpers that add / remove AgentPet's entries in a Claude Code settings object.
// Our entries are recognised by the script name in their command, so the user's own hooks are
// never touched and installing twice changes nothing.

export const MARK = 'agentpet-send'

/** Fire-and-forget events (async: Claude Code never waits for them). */
export const EVENT_HOOKS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'StopFailure',
  'SessionEnd'
]

/** Seconds Claude Code lets the permission hook wait (the app answers within 120). */
export const PERMISSION_TIMEOUT_S = 130

const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUse', 'PermissionRequest'])

function isOurs(handler) {
  return [handler?.command, ...(handler?.args ?? [])].some(
    (part) => typeof part === 'string' && part.includes(MARK)
  )
}

export function isOurStatusLine(statusLine) {
  return typeof statusLine?.command === 'string' && statusLine.command.includes(MARK)
}

function group(event, handler) {
  return TOOL_EVENTS.has(event) ? { matcher: '*', hooks: [handler] } : { hooks: [handler] }
}

/** The entries AgentPet adds, for showing the user before installing. */
export function agentPetEntries(cliPath) {
  const run = (...args) => ({
    type: 'command',
    command: 'node',
    args: [cliPath, 'claude-code', ...args]
  })
  const hooks = {}
  // each event takes a list of matcher groups
  for (const event of EVENT_HOOKS) hooks[event] = [group(event, { ...run(), async: true })]
  hooks.PermissionRequest = [
    group('PermissionRequest', { ...run('permission'), timeout: PERMISSION_TIMEOUT_S })
  ]
  return {
    hooks,
    statusLine: { type: 'command', command: `node "${cliPath}" claude-code statusline` }
  }
}

/** Copy of settings without any AgentPet hook handlers (empty groups / events are dropped). */
export function removeAgentPet(settings) {
  const next = structuredClone(settings ?? {})
  if (next.hooks && typeof next.hooks === 'object') {
    for (const [event, groups] of Object.entries(next.hooks)) {
      if (!Array.isArray(groups)) continue
      const kept = groups
        .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !isOurs(h)) }))
        .filter((g) => g.hooks.length > 0)
      if (kept.length) next.hooks[event] = kept
      else delete next.hooks[event]
    }
    if (Object.keys(next.hooks).length === 0) delete next.hooks
  }
  if (isOurStatusLine(next.statusLine)) delete next.statusLine
  return next
}

/** Copy of settings with AgentPet's hooks and status line added (after removing old ones). */
export function addAgentPet(settings, cliPath) {
  const next = removeAgentPet(settings)
  const entries = agentPetEntries(cliPath)
  next.hooks ??= {}
  for (const [event, groups] of Object.entries(entries.hooks)) {
    next.hooks[event] = [...(next.hooks[event] ?? []), ...groups]
  }
  next.statusLine = entries.statusLine
  return next
}

/** True when the settings already contain AgentPet's hooks. */
export function hasAgentPet(settings) {
  return Object.values(settings?.hooks ?? {}).some(
    (groups) => Array.isArray(groups) && groups.some((g) => (g.hooks ?? []).some(isOurs))
  )
}
