import { timeMood } from '@shared/progress'
import { useEffect, useRef, useState } from 'react'
import { ApprovalBubble } from './ApprovalBubble'
import { demoUsage, useDemo } from './demo'
import { InfoBubble } from './InfoBubble'
import type { Mood } from './moods'
import { MusicBubble } from './MusicBubble'
import { Pet } from './pets/Pet'
import { sessionLine } from './sessionLine'
import { playMeow, playToot, startPurr, stopPurr } from './sounds'
import { useAgentBridge, useMood, usePetStore } from './store'
import { UsageBar } from './UsageBar'
import { usePetPointer } from './usePetPointer'
import { useSettings } from './useSettings'

const FOCUS_MOODS: ReadonlySet<Mood> = new Set(['needs', 'hiss', 'sad'])
const TOAST_MS = 4000
/** keeps the hover bubble open while the pointer crosses the gap to its buttons */
const HOVER_GRACE_MS = 500

/** Meow when the agent starts needing you, toot when a task is done (unless muted). */
function useMoodSounds(mood: Mood, muted: boolean, double: boolean): void {
  const previous = useRef(mood)
  useEffect(() => {
    if (mood !== previous.current && !muted) {
      if (mood === 'needs') playMeow()
      if (mood === 'happy') {
        playToot()
        if (double) setTimeout(playToot, 380)
      }
    }
    previous.current = mood
  }, [mood, muted, double])
}

/** "go to bed 😴" when the agent works late at night, "good morning ☕" once a day. */
function useTimeGreetings(mood: Mood, name: string): void {
  const greeted = useRef<{ morning?: string; lateNight?: number }>({})
  useEffect(() => {
    if (mood !== 'working') return
    const now = Date.now()
    const { greeting } = timeMood(now)
    const { showToast } = usePetStore.getState()
    const today = new Date(now).toDateString()
    if (greeting === 'morning' && greeted.current.morning !== today) {
      greeted.current.morning = today
      showToast(`good morning ☕ ${name} is up`)
    }
    if (greeting === 'late_night' && now - (greeted.current.lateNight ?? 0) > 60 * 60_000) {
      greeted.current.lateNight = now
      showToast('it’s late… go to bed 😴')
    }
  }, [mood, name])
}

/** A counter that bumps to replay a one-shot animation, and resets once it has played. */
function useOneShot(durationMs: number): [number, () => void] {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!count) return
    const timer = setTimeout(() => setCount(0), durationMs)
    return () => clearTimeout(timer)
  }, [count, durationMs])
  return [count, () => setCount((c) => c + 1)]
}

function App(): React.JSX.Element {
  const { skin, demo, muted, focusMode, music: musicOn } = useSettings()
  const { step: demoStep, next: nextDemoStep } = useDemo(demo)
  useAgentBridge()
  const liveMood = useMood()
  const liveUsage = usePetStore((s) => s.usage)
  const prompts = usePetStore((s) => s.prompts)
  const session = usePetStore((s) => s.session)
  const warning = usePetStore((s) => s.warning)
  const look = usePetStore((s) => s.look)
  const walk = usePetStore((s) => s.walk)
  const rare = usePetStore((s) => s.rare)
  const toast = usePetStore((s) => s.toast)
  const music = usePetStore((s) => s.music)
  const headphones = usePetStore((s) => s.headphones)
  const grooving = usePetStore((s) => s.grooving)
  const musicResumed = usePetStore((s) => s.musicResumed)
  const dispatch = usePetStore((s) => s.dispatch)
  const [hoveredAt, setHoveredAt] = useState<number | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [petting, setPetting] = useState(false)
  const [partyHat] = useState(() => timeMood(Date.now()).partyHat)
  const [flick, playFlick] = useOneShot(260)
  const [wiggle, playWiggle] = useOneShot(620)

  usePetPointer({
    onClick: () => {
      dispatch({ type: 'pet_clicked' })
      window.api.petClicked()
    },
    onHover: (hovering) => {
      clearTimeout(hoverTimer.current)
      if (hovering) setHoveredAt((at) => at ?? Date.now())
      else hoverTimer.current = setTimeout(() => setHoveredAt(null), HOVER_GRACE_MS)
    },
    onPet: (on) => {
      setPetting(on)
      if (on && !muted) startPurr()
      else stopPurr()
    }
  })

  // music resumed: a quick happy wiggle
  const resumedRef = useRef(musicResumed)
  useEffect(() => {
    if (musicResumed !== resumedRef.current) playWiggle()
    resumedRef.current = musicResumed
  }, [musicResumed, playWiggle])

  const mood = demoStep?.mood ?? liveMood
  const usage = demoStep ? demoUsage(demoStep) : liveUsage
  const prompt = demoStep ? demoStep.prompt : prompts[0]
  const walking = !demoStep && walk.walking

  // Music sits below every agent mood and above wandering / sleeping:
  // idle + music = vibing; working + music = working with headphones on.
  const listening = !demoStep && musicOn && headphones
  const vibe = listening && mood === 'sleeping' ? (grooving ? 'groove' : 'still') : undefined

  useMoodSounds(mood, muted, rare === 'double')
  useTimeGreetings(liveMood, look?.petName ?? 'Noodle')

  // celebration bubbles fade away by themselves
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => usePetStore.setState({ toast: null }), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  // needs you (for real, not in the demo): hop toward the middle of the screen until answered
  const alert = !demoStep && mood === 'needs'
  useEffect(() => window.api.setAlert(alert), [alert])

  // focus mode: stay out of sight unless something needs attention (or he's vibing)
  if (focusMode && !demoStep && !prompt && !FOCUS_MOODS.has(mood) && !vibe) {
    return <main className="stage" />
  }

  const showMusicBubble = musicOn && !demoStep && (music.hasSession || headphones)
  let bubble: React.JSX.Element | null = null
  if (prompt) {
    bubble = (
      <ApprovalBubble
        prompt={prompt}
        more={demoStep ? 0 : prompts.length - 1}
        onDecide={(decision) =>
          demoStep ? nextDemoStep() : window.api.decide(prompt.id, decision)
        }
      />
    )
  } else if (!demoStep && mood === 'hiss' && warning) {
    bubble = <div className="bubble bubble-warning">⚠ {warning}</div>
  } else if (hoveredAt !== null && !demoStep && showMusicBubble) {
    // focus mode: music animation only, no song bubbles
    if (!focusMode) {
      bubble = (
        <MusicBubble
          music={music}
          agentLine={session ? sessionLine(session, hoveredAt) : undefined}
          onCommand={(command) => {
            window.api.musicCommand(command)
            playFlick()
          }}
        />
      )
    }
  } else if (toast && !demoStep && !(toast.music && focusMode)) {
    bubble = (
      <div key={toast.id} className="bubble bubble-info">
        {toast.text}
      </div>
    )
  } else if (hoveredAt !== null && !demoStep) {
    bubble = <InfoBubble session={session} look={look} now={hoveredAt} />
  }

  return (
    <main className="stage">
      {demoStep && <div className="demo-label">{demoStep.label}</div>}
      {bubble}
      <div className="pet-spot">
        <Pet
          skin={skin}
          mood={walking ? 'working' : mood}
          look={look}
          partyHat={partyHat}
          headphones={listening}
          walking={walking && !vibe}
          facing={walk.facing}
          rare={demoStep ? null : rare}
          vibe={vibe}
          flick={flick}
          wiggle={wiggle}
        />
        {petting && (
          <div className="hearts" aria-hidden>
            <span>❤</span>
            <span>❤</span>
            <span>❤</span>
          </div>
        )}
      </div>
      {usage && <UsageBar usage={usage} />}
    </main>
  )
}

export default App
