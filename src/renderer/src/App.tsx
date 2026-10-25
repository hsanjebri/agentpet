import { timeMood } from '@shared/progress'
import { useEffect, useRef, useState } from 'react'
import { ApprovalBubble } from './ApprovalBubble'
import { demoUsage, useDemo } from './demo'
import { InfoBubble } from './InfoBubble'
import type { Mood } from './moods'
import { Pet } from './pets/Pet'
import { playMeow, playToot, startPurr, stopPurr } from './sounds'
import { useAgentBridge, useMood, usePetStore } from './store'
import { UsageBar } from './UsageBar'
import { usePetPointer } from './usePetPointer'
import { useSettings } from './useSettings'

const FOCUS_MOODS: ReadonlySet<Mood> = new Set(['needs', 'hiss', 'sad'])
const TOAST_MS = 4000

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

function App(): React.JSX.Element {
  const { skin, demo, muted, focusMode } = useSettings()
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
  const dispatch = usePetStore((s) => s.dispatch)
  const [hoveredAt, setHoveredAt] = useState<number | null>(null)
  const [petting, setPetting] = useState(false)
  const [partyHat] = useState(() => timeMood(Date.now()).partyHat)

  usePetPointer({
    onClick: () => {
      dispatch({ type: 'pet_clicked' })
      window.api.petClicked()
    },
    onHover: (hovering) => setHoveredAt(hovering ? Date.now() : null),
    onPet: (on) => {
      setPetting(on)
      if (on && !muted) startPurr()
      else stopPurr()
    }
  })

  const mood = demoStep?.mood ?? liveMood
  const usage = demoStep ? demoUsage(demoStep) : liveUsage
  const prompt = demoStep ? demoStep.prompt : prompts[0]
  const walking = !demoStep && walk.walking
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

  // focus mode: stay out of sight unless something needs attention
  if (focusMode && !demoStep && !prompt && !FOCUS_MOODS.has(mood)) return <main className="stage" />

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
  } else if (toast && !demoStep) {
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
          walking={walking}
          facing={walk.facing}
          rare={demoStep ? null : rare}
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
