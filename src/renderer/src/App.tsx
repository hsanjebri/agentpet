import { ApprovalBubble } from './ApprovalBubble'
import { demoUsage, useDemo } from './demo'
import { Pet } from './pets/Pet'
import { useAgentBridge, useMood, usePetStore } from './store'
import { UsageBar } from './UsageBar'
import { usePetPointer } from './usePetPointer'
import { useSettings } from './useSettings'

function App(): React.JSX.Element {
  const { skin, demo } = useSettings()
  const { step: demoStep, next: nextDemoStep } = useDemo(demo)
  useAgentBridge()
  const liveMood = useMood()
  const liveUsage = usePetStore((s) => s.usage)
  const prompts = usePetStore((s) => s.prompts)
  const dispatch = usePetStore((s) => s.dispatch)
  usePetPointer(() => dispatch({ type: 'pet_clicked' }))

  const mood = demoStep?.mood ?? liveMood
  const usage = demoStep ? demoUsage(demoStep) : liveUsage
  const prompt = demoStep ? demoStep.prompt : prompts[0]

  return (
    <main className="stage">
      {demoStep && <div className="demo-label">{demoStep.label}</div>}
      {prompt && (
        <ApprovalBubble
          prompt={prompt}
          more={demoStep ? 0 : prompts.length - 1}
          onDecide={(decision) =>
            demoStep ? nextDemoStep() : window.api.decide(prompt.id, decision)
          }
        />
      )}
      <Pet skin={skin} mood={mood} />
      {usage && <UsageBar usage={usage} />}
    </main>
  )
}

export default App
