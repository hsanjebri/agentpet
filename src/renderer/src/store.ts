// Renderer state: mood, latest usage and waiting permission prompts.
import type { PermissionPrompt, SessionSummary, UsageInfo } from '@shared/events'
import type { PetMoment, WalkState } from '@shared/ipc'
import {
  HEADPHONES_OFF_AFTER_MS,
  type MusicState,
  NO_MUSIC,
  songLine,
  trackKey
} from '@shared/music'
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
  /** a short celebration bubble ("level 10!", "yum 🐟"); music ones are hidden in focus mode */
  toast: { text: string; id: number; music?: boolean } | null
  showToast(text: string, music?: boolean): void
  music: MusicState
  /** headphones stay on for a while after the music stops */
  headphones: boolean
  grooving: boolean
  /** bumps when playback resumes (for a happy wiggle) */
  musicResumed: number
  /** bumps when the first-run setup is done (he says hi) */
  hello: number
  setMusic(music: MusicState): void
  dispatch(input: MoodInput): void
  setUsage(usage: UsageInfo): void
  setPrompts(prompts: PermissionPrompt[]): void
  setSession(session: SessionSummary | null): void
}

let quietTimer: ReturnType<typeof setTimeout> | undefined

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
  showToast: (text, music) => set({ toast: { text, id: Date.now(), music } }),
  music: NO_MUSIC,
  headphones: false,
  grooving: false,
  musicResumed: 0,
  hello: 0,
  setMusic: (next) => {
    const prev = get().music
    const sameTrack = trackKey(next) !== null && trackKey(next) === trackKey(prev)
    // keep the album art of the current track (the helper only sends it once)
    const music = sameTrack && !next.thumb ? { ...next, thumb: prev.thumb } : next
    if (next.playing) {
      clearTimeout(quietTimer)
      quietTimer = undefined
      set({
        music,
        headphones: true,
        grooving: true,
        musicResumed: sameTrack && !prev.playing ? get().musicResumed + 1 : get().musicResumed
      })
      if (!sameTrack && next.title) get().showToast(`🎵 ${songLine(next)}`, true)
      return
    }
    // paused or gone: stop bobbing now, take the headphones off a bit later
    if (get().grooving) {
      clearTimeout(quietTimer)
      quietTimer = setTimeout(() => set({ headphones: false }), HEADPHONES_OFF_AFTER_MS)
    }
    set({ music, grooving: false })
  },
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
    case 'update':
      showToast(`update ${moment.version} is ready: restart from the tray ✨`)
      break
    case 'hello':
      usePetStore.setState({ hello: usePetStore.getState().hello + 1 })
      showToast(`hi! I'm ${name} 👋`)
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
      window.api.onMoment(onMoment),
      window.api.onMusic((music) => usePetStore.getState().setMusic(music))
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
