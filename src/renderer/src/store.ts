// Renderer state: mood, latest usage and waiting permission prompts.
import type { PermissionPrompt, SessionSummary, UsageInfo } from '@shared/events'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import {
  type MoodInput,
  type MoodState,
  currentMood,
  initialMoodState,
  nextChangeAt,
  nextMoodState
} from './moodMachine'
import type { Mood } from './moods'
import { crossedWarning } from './usage'

interface PetStore {
  moodState: MoodState
  usage: UsageInfo | null
  prompts: PermissionPrompt[]
  session: SessionSummary | null
  /** why the pet last hissed, e.g. "touching .env" */
  warning: string | null
  dispatch(input: MoodInput): void
  setUsage(usage: UsageInfo): void
  setPrompts(prompts: PermissionPrompt[]): void
  setSession(session: SessionSummary | null): void
}

export const usePetStore = create<PetStore>()((set, get) => ({
  moodState: initialMoodState(Date.now()),
  usage: null,
  prompts: [],
  session: null,
  warning: null,
  dispatch: (input) => set({ moodState: nextMoodState(get().moodState, input, Date.now()) }),
  setUsage: (usage) => {
    if (crossedWarning(get().usage, usage)) get().dispatch({ type: 'sweat' })
    set({ usage })
  },
  setPrompts: (prompts) => set({ prompts }),
  setSession: (session) => set({ session })
}))

/** Feeds agent events, usage and prompts from the main process into the store. */
export function useAgentBridge(): void {
  useEffect(() => {
    const { dispatch, setUsage, setPrompts, setSession } = usePetStore.getState()
    const unsubscribe = [
      window.api.onAgentEvent((event) => {
        if (event.type === 'risky')
          usePetStore.setState({ warning: event.message ?? 'risky action' })
        dispatch({ type: 'event', event })
      }),
      window.api.onUsage(setUsage),
      window.api.onPermissions(setPrompts),
      window.api.onSession(setSession)
    ]
    return () => unsubscribe.forEach((off) => off())
  }, [])
}

/** The mood to show now; re-renders by itself when a timeout (happy, idle…) runs out. */
export function useMood(): Mood {
  const moodState = usePetStore((s) => s.moodState)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const at = nextChangeAt(moodState)
    if (at === null) return
    const timer = setTimeout(
      () => {
        usePetStore.getState().dispatch({ type: 'tick' })
        setNow(Date.now())
      },
      Math.max(0, at - Date.now()) + 20
    )
    return () => clearTimeout(timer)
  }, [moodState])

  // the store settles timeouts on every input, so the time of the last timer is enough here
  return currentMood(moodState, now)
}
