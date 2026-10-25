import { useEffect, useRef, useState } from 'react'
import { ApprovalBubble } from './ApprovalBubble'
import { demoUsage, useDemo } from './demo'
import { InfoBubble } from './InfoBubble'
import type { Mood } from './moods'
import { Pet } from './pets/Pet'
import { playMeow, playToot } from './sounds'
import { useAgentBridge, useMood, usePetStore } from './store'
import { UsageBar } from './UsageBar'
import { usePetPointer } from './usePetPointer'
import { useSettings } from './useSettings'

const FOCUS_MOODS: ReadonlySet<Mood> = new Set(['needs', 'hiss', 'sad'])

/** Meow when the agent starts needing you, toot when a task is done (unless muted). */
function useMoodSounds(mood: Mood, muted: boolean): void {
  const previous = useRef(mood)
  useEffect(() => {
    if (mood !== previous.current && !muted) {
      if (mood === 'needs') playMeow()
      if (mood === 'happy') playToot()
    }
    previous.current = mood
  }, [mood, muted])
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
  const dispatch = usePetStore((s) => s.dispatch)
  const [hoveredAt, setHoveredAt] = useState<number | null>(null)

  usePetPointer({
    onClick: () => {
      dispatch({ type: 'pet_clicked' })
      window.api.petClicked()
    },
    onHover: (hovering) => setHoveredAt(hovering ? Date.now() : null)
  })

  const mood = demoStep?.mood ?? liveMood
  const usage = demoStep ? demoUsage(demoStep) : liveUsage
  const prompt = demoStep ? demoStep.prompt : prompts[0]
  useMoodSounds(mood, muted)

  // needs you (for real, not in the demo): hop toward the middle of the screen until answered
  const alert = !demoStep && mood === 'needs'
  useEffect(() => window.api.setAlert(alert), [alert])

  // focus mode: stay out of sight unless something needs attention
  if (focusMode && !demoStep && !prompt && !FOCUS_MOODS.has(mood)) return <main className="stage" />

  return (
    <main className="stage">
      {demoStep && <div className="demo-label">{demoStep.label}</div>}
      {prompt ? (
        <ApprovalBubble
          prompt={prompt}
          more={demoStep ? 0 : prompts.length - 1}
          onDecide={(decision) =>
            demoStep ? nextDemoStep() : window.api.decide(prompt.id, decision)
          }
        />
      ) : !demoStep && mood === 'hiss' && warning ? (
        <div className="bubble bubble-warning">⚠ {warning}</div>
      ) : (
        hoveredAt !== null && !demoStep && <InfoBubble session={session} now={hoveredAt} />
      )}
      <Pet skin={skin} mood={mood} />
      {usage && <UsageBar usage={usage} />}
    </main>
  )
}

export default App
