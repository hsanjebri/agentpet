// Mood demo (tray › Mood demo): plays a typical agent session, then the rarer moods, on a loop.
import { useEffect, useState } from 'react'
import type { Mood } from './moods'

export interface DemoStep {
  mood: Mood
  label: string
  ms: number
}

export const DEMO_SEQUENCE: readonly DemoStep[] = [
  { mood: 'sleeping', label: 'idle · sleeping', ms: 3000 },
  { mood: 'working', label: 'agent is working', ms: 4000 },
  { mood: 'needs', label: 'needs your approval!', ms: 4000 },
  { mood: 'working', label: 'back to work', ms: 3000 },
  { mood: 'happy', label: 'task done!', ms: 5000 },
  { mood: 'sweat', label: 'session getting pricey', ms: 3500 },
  { mood: 'sad', label: 'tests failed', ms: 3500 },
  { mood: 'hiss', label: 'risky action (.env)', ms: 3500 }
]

/** The current demo step while the demo is on, otherwise null. */
export function useDemo(enabled: boolean): DemoStep | null {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const timer = setTimeout(
      () => setIndex((i) => (i + 1) % DEMO_SEQUENCE.length),
      DEMO_SEQUENCE[index].ms
    )
    return () => clearTimeout(timer)
  }, [enabled, index])

  return enabled ? DEMO_SEQUENCE[index] : null
}
