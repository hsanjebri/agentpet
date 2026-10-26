// Settings › About.
import type { AppInfo } from '@shared/ipc'
import { useEffect, useState } from 'react'
import { Noodle } from '../pets/noodle/Noodle'
import { Section } from './controls'

const SITE = 'https://hsanjebri.github.io/agentpet/'
const REPO = 'https://github.com/hsanjebri/agentpet'

export function AboutSection(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    window.api.appInfo().then(setInfo)
  }, [])

  return (
    <Section title="ℹ️ About">
      <div className="settings-pet-preview">
        <Noodle mood="happy" scale={2} />
      </div>
      <p>
        <b>AgentPet {info?.version}</b>: a little pixel cat that keeps you company on your desktop.
      </p>
      <ul className="settings-list">
        <li>
          Website:{' '}
          <a href={SITE} target="_blank" rel="noreferrer">
            {SITE}
          </a>
        </li>
        <li>
          Source code:{' '}
          <a href={REPO} target="_blank" rel="noreferrer">
            {REPO}
          </a>
        </li>
        <li>
          License: MIT (
          <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
            read it
          </a>
          )
        </li>
        <li>Pixel art, sounds and code: AgentPet contributors. Sounds are synthesized live.</li>
      </ul>
    </Section>
  )
}
