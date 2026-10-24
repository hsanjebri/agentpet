// Mood demo (tray › Mood demo): plays a typical agent session, then the rarer moods, on a loop.
// Usage and the approval bubble are faked too, so everything can be seen without an agent.
import type { PermissionPrompt, UsageInfo } from '@shared/events'
import { useEffect, useState } from 'react'
import type { Mood } from './moods'

export interface DemoStep {
  mood: Mood
  label: string
  ms: number
  sessionPct: number
  prompt?: PermissionPrompt
}

const DEMO_PROMPT: PermissionPrompt = {
  id: 'demo',
  agent: 'claude-code',
  cwd: '/projects/my-app',
  toolName: 'Bash',
  target: 'npm test -- --watch=false',
  createdAt: 0
}

export const DEMO_SEQUENCE: readonly DemoStep[] = [
  { mood: 'sleeping', label: 'idle · sleeping', ms: 3000, sessionPct: 12 },
  { mood: 'working', label: 'agent is working', ms: 4000, sessionPct: 28 },
  {
    mood: 'needs',
    label: 'needs your approval!',
    ms: 6000,
    sessionPct: 34,
    prompt: DEMO_PROMPT
  },
  { mood: 'working', label: 'back to work', ms: 3000, sessionPct: 45 },
  { mood: 'happy', label: 'task done!', ms: 5000, sessionPct: 52 },
  { mood: 'sweat', label: 'session getting pricey', ms: 3500, sessionPct: 83 },
  { mood: 'sad', label: 'tests failed', ms: 3500, sessionPct: 88 },
  { mood: 'hiss', label: 'risky action (.env)', ms: 3500, sessionPct: 91 }
]

export function demoUsage(step: DemoStep): UsageInfo {
  return { sessionPct: step.sessionPct, contextPct: step.sessionPct / 2, timestamp: 0 }
}

/** The current demo step while the demo is on (null when off), and a way to skip ahead. */
export function useDemo(enabled: boolean): { step: DemoStep | null; next(): void } {
  const [index, setIndex] = useState(0)
  const next = (): void => setIndex((i) => (i + 1) % DEMO_SEQUENCE.length)

  useEffect(() => {
    if (!enabled) return
    const timer = setTimeout(
      () => setIndex((i) => (i + 1) % DEMO_SEQUENCE.length),
      DEMO_SEQUENCE[index].ms
    )
    return () => clearTimeout(timer)
  }, [enabled, index])

  return { step: enabled ? DEMO_SEQUENCE[index] : null, next }
}
