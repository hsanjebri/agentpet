// Pure helpers that add / remove AgentPet's entries in a Claude Code settings object.
// Our entries are recognised by "agentpet-send" in their command (the curl config file name, or
// the Node script older versions used), so the user's own hooks are never touched and installing
// twice changes nothing.

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

/** Seconds Claude Code lets the permission hook wait (curl gives up at 125). */
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

/** Seconds curl gives each kind of hook (the app answers permissions within 120). */
const MAX_TIME_S = { event: 6, permission: 125, statusline: 3 }

/**
 * The entries AgentPet adds, for showing the user before installing. Every hook is curl
 * (built into Windows 10+, macOS and Linux) POSTing Claude Code's JSON to the app; the curl
 * config file holds the app's address and token. curl fails quietly when the app is closed,
 * and Claude Code then carries on as usual.
 */
export function agentPetEntries(curlConfigPath, platform = process.platform) {
  // curl.exe: in PowerShell plain "curl" is an alias for Invoke-WebRequest
  const curl = platform === 'win32' ? 'curl.exe' : 'curl'
  const curlArgs = (mode) => [
    '-K',
    curlConfigPath,
    '-H',
    `X-AgentPet-Hook: ${mode}`,
    '-m',
    String(MAX_TIME_S[mode]),
    '--data-binary',
    '@-'
  ]
  // exec form (args): no shell in between, works the same everywhere
  const run = (mode) => ({ type: 'command', command: curl, args: curlArgs(mode) })
  const hooks = {}
  // each event takes a list of matcher groups
  for (const event of EVENT_HOOKS) hooks[event] = [group(event, { ...run('event'), async: true })]
  hooks.PermissionRequest = [
    group('PermissionRequest', { ...run('permission'), timeout: PERMISSION_TIMEOUT_S })
  ]
  // the status line only takes a shell command: quote everything (bash and PowerShell alike)
  const statusArgs = curlArgs('statusline').map((a) =>
    a.startsWith('-') ? a : `"${a.replace(/\\/g, '/')}"`
  )
  return {
    hooks,
    statusLine: { type: 'command', command: [curl, ...statusArgs].join(' ') }
  }
}

/** Our groups in each event, as sorted JSON lines, to compare installs. */
function ourGroups(hooks) {
  const found = []
  for (const [event, groups] of Object.entries(hooks ?? {})) {
    if (!Array.isArray(groups)) continue
    const ours = groups.filter((g) => (g.hooks ?? []).some(isOurs))
    if (ours.length) found.push(`${event} ${JSON.stringify(ours)}`)
  }
  return found.sort()
}

/** True when settings hold exactly the entries this version would add (false for old installs). */
export function isCurrent(settings, curlConfigPath, platform = process.platform) {
  const expected = agentPetEntries(curlConfigPath, platform)
  const have = ourGroups(settings?.hooks)
  const want = ourGroups(expected.hooks)
  return (
    JSON.stringify(have) === JSON.stringify(want) &&
    JSON.stringify(settings?.statusLine) === JSON.stringify(expected.statusLine)
  )
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
export function addAgentPet(settings, curlConfigPath, platform = process.platform) {
  const next = removeAgentPet(settings)
  const entries = agentPetEntries(curlConfigPath, platform)
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
