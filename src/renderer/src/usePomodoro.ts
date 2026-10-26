import type { PomodoroState } from '@shared/pomodoro'
import { useEffect, useState } from 'react'

/** The Pomodoro timer's state, live from the main process (null until it answers). */
export function usePomodoro(): PomodoroState | null {
  const [state, setState] = useState<PomodoroState | null>(null)
  useEffect(() => {
    window.api.getPomodoro().then(setState)
    return window.api.onPomodoro(setState)
  }, [])
  return state
}
