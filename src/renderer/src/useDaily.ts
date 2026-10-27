import type { DailyState } from '@shared/ipc'
import { useEffect, useState } from 'react'

const NONE: DailyState = {
  outfit: null,
  praying: false,
  ramadan: null,
  waterDue: false,
  stretchDue: false,
  bedtime: null,
  guarding: null,
  laser: false
}

/** Weather outfit, prayer mat, Ramadan, water, distraction guard, laser: live from main. */
export function useDaily(): DailyState {
  const [state, setState] = useState(NONE)
  useEffect(() => {
    window.api.getDaily().then(setState)
    return window.api.onDaily(setState)
  }, [])
  return state
}
