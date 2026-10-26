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
import { runPreviousStatusLine } from './connect'
import { focusAgentWindow } from './focus'
import { statusLineText } from './hookInput'
import { rollRare } from '../shared/progress'
import { PermissionQueue } from './permissions'
import { phoneOnEvent, phoneUserIsHere } from './phone'
import { flushProgress, recordActivity, sendMoment } from './progress'
import { RiskWatcher } from './risk'
import { type PermissionInfo, startAgentServer } from './server'
import { SessionTracker } from './sessions'
import { interruptWander } from './wander'
import { setAlert } from './window'

/** After these events a session's pending permission prompts were answered somewhere else. */
const RESOLVES_PROMPTS: ReadonlySet<PetEventType> = new Set([
  'tool_done',
  'done',
  'working',
  'session_end'
])

/** An event made by the app itself, about a permission request. */
function eventFor(info: PermissionInfo, type: PetEventType): PetEvent {
  const { agent, sessionId, cwd, toolName, target, pid } = info
  return { type, agent, sessionId, cwd, toolName, target, pid, timestamp: Date.now() }
}

let lastActivityAt = 0

/** When the agent last did anything (0 = not since the app started). */
export function lastAgentActivity(): number {
  return lastActivityAt
}

/** Feeds the pet's memory: tasks, tools, risks, and the fun bits (fish, rare moments). */
function remember(event: PetEvent): void {
  if (event.type === 'tool') {
    recordActivity({ type: 'tool', toolName: event.toolName, target: event.target })
  } else if (event.type === 'risky') {
    recordActivity({ type: 'risky', reason: event.message ?? 'risky action' })
  } else if (event.type === 'done') {
    const rare = rollRare()
    recordActivity({ type: 'task_done', rare })
    sendMoment({ kind: 'fed' })
    if (rare) sendMoment({ kind: 'rare', rare })
  }
}

function broadcast(channel: string, value: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, value)
}

export function startBridge(): void {
  const permissions = new PermissionQueue((prompts) => broadcast(IPC.permissions, prompts))
  const sessions = new SessionTracker()
  const risks = new RiskWatcher()
  let lastUsage: UsageInfo | null = null
  let needsSessionId: string | undefined // who asked for the user last

  const sendEvent = (event: PetEvent): void => {
    lastActivityAt = Date.now()
    interruptWander()
    if (event.sessionId && RESOLVES_PROMPTS.has(event.type)) {
      const answered = permissions.resolveSession(event.sessionId)
      // the tool ran although nobody clicked the pet: approved in the terminal
      if (event.type === 'tool_done')
        for (let i = 0; i < answered; i++) recordActivity({ type: 'approved' })
    }
    if (event.type === 'needs_you') needsSessionId = event.sessionId
    sessions.update(event)
    broadcast(IPC.agentEvent, event)
    broadcast(IPC.session, sessions.latest())

    remember(event)
    phoneOnEvent(event)

    const risk = risks.check(event)
    if (risk) {
      const risky: PetEvent = { ...event, type: 'risky', message: risk }
      broadcast(IPC.agentEvent, risky)
      remember(risky)
    }
  }

  startAgentServer({
    onEvent: sendEvent,
    onUsage: (usage) => {
      lastUsage = usage
      broadcast(IPC.usage, usage)
    },
    onPermission: (info, cancelled) => {
      sendEvent(eventFor(info, 'needs_you'))
      return permissions.request(info, cancelled)
    },
    // keep the user's own status line if they had one before AgentPet
    statusLine: async (raw, usage) => (await runPreviousStatusLine(raw)) ?? statusLineText(usage),
    wantsPid: (sessionId) => sessions.needsPid(sessionId),
    onAgentPid: (sessionId, pid) => sessions.setPid(sessionId, pid)
  })
    .then(({ port }) => console.log(`[agentpet] event server on 127.0.0.1:${port}`))
    .catch((err) => console.error('[agentpet] event server failed to start:', err))

  ipcMain.on(IPC.decide, (_, id: unknown, decision: unknown) => {
    if (typeof id !== 'string') return
    if (!PERMISSION_DECISIONS.includes(decision as PermissionDecision)) return
    const prompt = permissions.decide(id, decision as PermissionDecision)
    // answered from the pet: the agent carries on right away
    if (prompt) phoneUserIsHere()
    if (prompt && decision === 'allow') recordActivity({ type: 'approved' })
    if (prompt && decision !== 'terminal') sendEvent(eventFor(prompt, 'tool'))
  })

  ipcMain.on(IPC.setAlert, (e, on: unknown) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win && typeof on === 'boolean') setAlert(win, on)
  })

  // clicking the pet: go to whoever needs the user (or the latest session), pet back home
  ipcMain.on(IPC.petClicked, (e) => {
    phoneUserIsHere()
    const sessionId = permissions.list()[0]?.sessionId ?? needsSessionId
    const pid = sessions.pidFor(sessionId)
    if (pid) focusAgentWindow(pid)
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) setAlert(win, false)
  })

  // a freshly (re)loaded window gets the current state
  app.on('browser-window-created', (_, win) => {
    win.webContents.on('did-finish-load', () => {
      win.webContents.send(IPC.permissions, permissions.list())
      if (lastUsage) win.webContents.send(IPC.usage, lastUsage)
      win.webContents.send(IPC.session, sessions.latest())
    })
  })

  // never leave a hook waiting on a pet that is gone
  app.on('before-quit', () => {
    permissions.clear()
    flushProgress()
  })
}
