// Phone ping: decides when to notify the user's phone (agent waiting too long, long task done)
// and what the notification says. Pure logic; phone.ts does the sending.
import { randomBytes } from 'crypto'

import type { PhoneSettings } from '../shared/ipc'

export type { PhoneSettings }

export const DEFAULT_SERVER = 'https://ntfy.sh'
export const DELAY_CHOICES = [1, 2, 5, 10] as const
/** A finished task only pings if it ran at least this long. */
export const LONG_TASK_MS = 3 * 60_000

/** ntfy topics: letters, digits, - and _, up to 64 characters. */
export function validTopic(topic: string): boolean {
  return /^[A-Za-z0-9_-]{6,64}$/.test(topic)
}

/** Hard to guess: an ntfy topic works like a secret link. */
export function randomTopic(): string {
  return `agentpet-${randomBytes(9)
    .toString('base64url')
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase()}`
}

export function validServer(server: string): boolean {
  try {
    const url = new URL(server)
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export function defaultPhoneSettings(): PhoneSettings {
  return {
    enabled: false,
    server: DEFAULT_SERVER,
    topic: randomTopic(),
    delayMin: 2,
    details: false,
    done: false
  }
}

/** Cleans settings coming from the renderer; returns null if they can't be used. */
export function parsePhoneSettings(input: unknown): PhoneSettings | null {
  if (typeof input !== 'object' || input === null) return null
  const r = input as Record<string, unknown>
  const topic = typeof r.topic === 'string' ? r.topic.trim() : ''
  const server = typeof r.server === 'string' ? r.server.trim().replace(/\/+$/, '') : DEFAULT_SERVER
  if (!validTopic(topic) || !validServer(server)) return null
  const delay = DELAY_CHOICES.find((d) => d === r.delayMin) ?? 2
  return {
    enabled: r.enabled === true,
    server,
    topic,
    delayMin: delay,
    details: r.details === true,
    done: r.done === true
  }
}

export interface Ping {
  title: string
  message: string
  /** ntfy priority: 4 = high (waiting for you), 3 = default (task done) */
  priority: 3 | 4
  tags: string[]
}

interface Waiting {
  project?: string
  tool?: string
  target?: string
  since: number
  pinged: boolean
}

export interface AgentInfo {
  sessionId?: string
  project?: string
  tool?: string
  target?: string
}

const key = (sessionId?: string): string => sessionId ?? '?'

/** Tracks which sessions are waiting for the user, and since when. */
export class PingWatcher {
  private waiting = new Map<string, Waiting>()
  private workingSince = new Map<string, number>()

  /** The agent asked for the user (permission, question…). */
  needs(info: AgentInfo, now: number): void {
    const k = key(info.sessionId)
    const current = this.waiting.get(k)
    // keep the start of the wait, but update what it wants
    this.waiting.set(k, { ...info, since: current?.since ?? now, pinged: current?.pinged ?? false })
  }

  /** The agent carried on (or the user answered): nothing to ping about. */
  resolved(sessionId?: string): void {
    this.waiting.delete(key(sessionId))
  }

  /** The user is here (clicked the pet): stop everything pending. */
  userIsHere(): void {
    this.waiting.clear()
  }

  working(sessionId: string | undefined, now: number): void {
    const k = key(sessionId)
    if (!this.workingSince.has(k)) this.workingSince.set(k, now)
  }

  /** A task finished: a ping if it was a long one. */
  done(info: AgentInfo, now: number, settings: PhoneSettings): Ping | null {
    const k = key(info.sessionId)
    const since = this.workingSince.get(k)
    this.workingSince.delete(k)
    this.waiting.delete(k)
    if (!settings.done || since === undefined || now - since < LONG_TASK_MS) return null
    const minutes = Math.round((now - since) / 60_000)
    return {
      title: 'Claude finished 🌈',
      message: `Done${info.project ? ` in ${info.project}` : ''} after ${minutes} min.`,
      priority: 3,
      tags: ['rainbow']
    }
  }

  /** Pings that are due now (each wait pings once). */
  due(now: number, settings: PhoneSettings): Ping[] {
    const pings: Ping[] = []
    for (const w of this.waiting.values()) {
      if (w.pinged || now - w.since < settings.delayMin * 60_000) continue
      w.pinged = true
      pings.push(waitingPing(w, now, settings))
    }
    return pings
  }
}

export function waitingPing(
  w: Omit<Waiting, 'pinged'>,
  now: number,
  settings: PhoneSettings
): Ping {
  const minutes = Math.max(1, Math.round((now - w.since) / 60_000))
  const where = w.project ? ` in ${w.project}` : ''
  const what =
    settings.details && w.tool ? `\nWants to use ${w.tool}${w.target ? `: ${w.target}` : ''}` : ''
  return {
    title: 'Claude needs you 🐱',
    message: `Waiting for your approval${where} (${minutes} min).${what}`,
    priority: 4,
    tags: ['cat', 'bell']
  }
}
