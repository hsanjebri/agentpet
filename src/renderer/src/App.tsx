import { useDemo } from './demo'
import { Pet } from './pets/Pet'
import { usePetPointer } from './usePetPointer'
import { useSettings } from './useSettings'

function App(): React.JSX.Element {
  const { skin, demo } = useSettings()
  const demoStep = useDemo(demo)
  usePetPointer()

  return (
    <main className="stage">
      {demoStep && <div className="demo-label">{demoStep.label}</div>}
      <Pet skin={skin} mood={demoStep?.mood ?? 'sleeping'} />
    </main>
  )
}

export default App
