// Connects the agent (event server) to the pet window(s).
import { BrowserWindow, app, ipcMain } from 'electron'
import {
  PERMISSION_DECISIONS,
  type PermissionDecision,
  type PetEvent,
  type PetEventType,
  type UsageInfo
} from '../shared/events'
import { IPC } from '../shared/ipc'
import { PermissionQueue } from './permissions'
import { type PermissionInfo, startAgentServer } from './server'

/** After these events a session's pending permission prompts were answered somewhere else. */
const RESOLVES_PROMPTS: ReadonlySet<PetEventType> = new Set([
  'tool_done',
  'done',
  'working',
  'session_end'
])

/** An event made by the app itself, about a permission request. */
function eventFor(info: PermissionInfo, type: PetEventType): PetEvent {
  const { agent, sessionId, cwd, toolName, target } = info
  return { type, agent, sessionId, cwd, toolName, target, timestamp: Date.now() }
}

function broadcast(channel: string, value: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, value)
}

export function startBridge(): void {
  const permissions = new PermissionQueue((prompts) => broadcast(IPC.permissions, prompts))
  let lastUsage: UsageInfo | null = null

  const sendEvent = (event: PetEvent): void => {
    if (event.sessionId && RESOLVES_PROMPTS.has(event.type)) {
      permissions.resolveSession(event.sessionId)
    }
    broadcast(IPC.agentEvent, event)
  }

  startAgentServer({
    onEvent: sendEvent,
    onUsage: (usage) => {
      lastUsage = usage
      broadcast(IPC.usage, usage)
    },
    onPermission: (info, cancelled) => {
      broadcast(IPC.agentEvent, eventFor(info, 'needs_you'))
      return permissions.request(info, cancelled)
    }
  })
    .then(({ port }) => console.log(`[agentpet] event server on 127.0.0.1:${port}`))
    .catch((err) => console.error('[agentpet] event server failed to start:', err))

  ipcMain.on(IPC.decide, (_, id: unknown, decision: unknown) => {
    if (typeof id !== 'string') return
    if (!PERMISSION_DECISIONS.includes(decision as PermissionDecision)) return
    const prompt = permissions.decide(id, decision as PermissionDecision)
    // answered from the pet: the agent carries on right away
    if (prompt && decision !== 'terminal') {
      broadcast(IPC.agentEvent, eventFor(prompt, 'tool'))
    }
  })

  // a freshly (re)loaded window gets the current state
  app.on('browser-window-created', (_, win) => {
    win.webContents.on('did-finish-load', () => {
      win.webContents.send(IPC.permissions, permissions.list())
      if (lastUsage) win.webContents.send(IPC.usage, lastUsage)
    })
  })

  // never leave a hook waiting on a pet that is gone
  app.on('before-quit', () => permissions.clear())
}
