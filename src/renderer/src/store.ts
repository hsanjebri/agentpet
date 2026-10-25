// Renderer state: mood, latest usage and waiting permission prompts.
import type { PermissionPrompt, SessionSummary, UsageInfo } from '@shared/events'
import type { PetMoment, WalkState } from '@shared/ipc'
import type { PetLook, RareMoment } from '@shared/progress'
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
  look: PetLook | null
  walk: WalkState
  /** a rare moment in progress (golden rainbow, double fart, asleep on the keyboard) */
  rare: RareMoment | null
  /** a short celebration bubble ("level 10!", "yum 🐟") */
  toast: { text: string; id: number } | null
  showToast(text: string): void
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
  look: null,
  walk: { walking: false, facing: 'right' },
  rare: null,
  toast: null,
  showToast: (text) => set({ toast: { text, id: Date.now() } }),
  dispatch: (input) => set({ moodState: nextMoodState(get().moodState, input, Date.now()) }),
  setUsage: (usage) => {
    if (crossedWarning(get().usage, usage)) get().dispatch({ type: 'sweat' })
    set({ usage })
  },
  setPrompts: (prompts) => set({ prompts }),
  setSession: (session) => set({ session })
}))

const ACCESSORY_NAMES = { tophat: 'a top hat 🎩', sunglasses: 'sunglasses 😎', crown: 'a crown 👑' }

function onMoment(moment: PetMoment): void {
  const { showToast, look } = usePetStore.getState()
  const name = look?.petName ?? 'Noodle'
  switch (moment.kind) {
    case 'rare':
      usePetStore.setState({ rare: moment.rare })
      if (moment.rare === 'golden') showToast('✨ GOLDEN rainbow! ✨')
      if (moment.rare === 'double') showToast('double fart!! 🌈🌈')
      break
    case 'level_up':
      showToast(`${name} reached level ${moment.level}! 🎉`)
      break
    case 'unlocked':
      showToast(`${name} unlocked ${ACCESSORY_NAMES[moment.item]}!`)
      break
    case 'fed':
      // a quieter thank-you, only when nothing bigger is showing
      if (!usePetStore.getState().toast) showToast('yum, a fish 🐟')
      break
  }
}

/** Feeds agent events, usage and prompts from the main process into the store. */
export function useAgentBridge(): void {
  useEffect(() => {
    const { dispatch, setUsage, setPrompts, setSession } = usePetStore.getState()
    const unsubscribe = [
      window.api.onAgentEvent((event) => {
        if (event.type === 'risky')
          usePetStore.setState({ warning: event.message ?? 'risky action' })
        // a rare moment lasts until the agent gets back to work
        if (event.type === 'working' || event.type === 'tool') usePetStore.setState({ rare: null })
        dispatch({ type: 'event', event })
      }),
      window.api.onUsage(setUsage),
      window.api.onPermissions(setPrompts),
      window.api.onSession(setSession),
      window.api.onLook((look) => usePetStore.setState({ look })),
      window.api.onWalk((walk) => usePetStore.setState({ walk })),
      window.api.onMoment(onMoment)
    ]
    window.api.getLook().then((look) => usePetStore.setState({ look }))
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
