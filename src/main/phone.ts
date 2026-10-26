// Phone ping: sends a push notification (ntfy) when the agent has waited too long for the user.
// Opt-in and off by default: this is the only feature that sends anything off the PC.
import { ipcMain } from 'electron'
import Store from 'electron-store'
import type { PetEvent } from '../shared/events'
import { IPC } from '../shared/ipc'
import { openPage } from './pages'
import {
  type Ping,
  type PhoneSettings,
  PingWatcher,
  defaultPhoneSettings,
  parsePhoneSettings
} from './phonePing'

const CHECK_MS = 15_000
const SEND_TIMEOUT_MS = 10_000

const store = new Store<{ phone: PhoneSettings }>({
  name: 'phone',
  defaults: { phone: defaultPhoneSettings() }
})
const watcher = new PingWatcher()

function settings(): PhoneSettings {
  return parsePhoneSettings(store.get('phone')) ?? defaultPhoneSettings()
}

function project(cwd?: string): string | undefined {
  return cwd?.split(/[\\/]/).filter(Boolean).pop()
}

/** POSTs a notification to the ntfy topic. Resolves with an error message, or null on success. */
async function send(ping: Ping, s: PhoneSettings): Promise<string | null> {
  try {
    const res = await fetch(`${s.server}/${s.topic}`, {
      method: 'POST',
      body: ping.message,
      headers: {
        // HTTP headers must be plain ASCII; ntfy turns the tags into emoji
        Title: ping.title.replace(/[^\x20-\x7E]/g, '').trim(),
        Priority: String(ping.priority),
        Tags: ping.tags.join(',')
      },
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
    })
    return res.ok ? null : `ntfy answered ${res.status}`
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

function sendAll(pings: Ping[]): void {
  const s = settings()
  if (!s.enabled) return
  for (const ping of pings) {
    send(ping, s).then((error) => {
      if (error) console.error('[agentpet] phone ping failed:', error)
    })
  }
}

/** Called by the bridge for every agent event. */
export function phoneOnEvent(event: PetEvent): void {
  const now = Date.now()
  const info = {
    sessionId: event.sessionId,
    project: project(event.cwd),
    tool: event.toolName,
    target: event.target
  }
  switch (event.type) {
    case 'needs_you':
      watcher.needs(info, now)
      break
    case 'working':
    case 'tool':
    case 'tool_done':
      watcher.resolved(event.sessionId)
      watcher.working(event.sessionId, now)
      break
    case 'done': {
      const ping = watcher.done(info, now, settings())
      if (ping) sendAll([ping])
      break
    }
    case 'session_end':
      watcher.resolved(event.sessionId)
      break
  }
}

/** The user clicked the pet or answered from it: they're here. */
export function phoneUserIsHere(): void {
  watcher.userIsHere()
}

export function openPhoneWindow(): void {
  openPage('phone', { title: 'Phone ping', width: 480, height: 600 })
}

export function startPhone(): void {
  // keep the generated topic stable from the first launch on (the phone subscribes to it)
  if (!parsePhoneSettings(store.get('phone'))) store.set('phone', defaultPhoneSettings())
  else store.set('phone', settings())

  setInterval(() => {
    const s = settings()
    if (s.enabled) sendAll(watcher.due(Date.now(), s))
  }, CHECK_MS)

  ipcMain.handle(IPC.getPhone, () => settings())
  ipcMain.handle(IPC.setPhone, (_, input: unknown) => {
    const next = parsePhoneSettings(input)
    if (!next)
      return { ok: false, error: 'Topic: 6–64 letters, digits, - or _. Server: https only.' }
    store.set('phone', next)
    return { ok: true }
  })
  ipcMain.handle(IPC.testPhone, async (_, input: unknown) => {
    const s = parsePhoneSettings(input)
    if (!s) return { ok: false, error: 'Check the topic and server first.' }
    const error = await send(
      {
        title: 'AgentPet test 🐱',
        message: 'Meow! Phone ping works. You will get a buzz when Claude waits for you.',
        priority: 3,
        tags: ['cat']
      },
      s
    )
    return error ? { ok: false, error } : { ok: true }
  })
}
