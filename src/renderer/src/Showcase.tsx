// Dev-only: the mood demo on a plain background, for screen recordings. Open the renderer URL
// with #showcase in a browser.
import { useEffect } from 'react'
import { ApprovalBubble } from './ApprovalBubble'
import { demoUsage, useDemo } from './demo'
import { Pet } from './pets/Pet'
import { UsageBar } from './UsageBar'

export default function Showcase(): React.JSX.Element | null {
  const { step } = useDemo(true)

  useEffect(() => {
    document.title = 'AgentPet showcase'
  }, [])

  if (!step) return null
  return (
    <div className="showcase">
      <main className="stage">
        <div className="demo-label">{step.label}</div>
        {step.prompt && <ApprovalBubble prompt={step.prompt} more={0} onDecide={() => {}} />}
        <Pet skin="noodle" mood={step.mood} />
        <UsageBar usage={demoUsage(step)} />
      </main>
    </div>
  )
}
