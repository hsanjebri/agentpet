// The Settings window: sections in a sidebar on the left, the section on the right. Every change
// applies right away (the pet wiggles); there is no Save button. In Fun & focus mode the Claude
// Code and Phone ping sections don't exist.
import type { PetSettings } from '@shared/ipc'
import { useEffect, useState } from 'react'
import { useLoadedSettings } from '../useSettings'
import { AboutSection } from './AboutSection'
import { ClaudeSection } from './ClaudeSection'
import { DailySection } from './DailySection'
import { FeaturesSection } from './FeaturesSection'
import { FriendsSection } from './FriendsSection'
import { GeneralSection } from './GeneralSection'
import { PetSection } from './PetSection'
import { PhoneSection } from './PhoneSection'
import { PrivacySection } from './PrivacySection'

export type SectionId =
  'pet' | 'features' | 'daily' | 'claude' | 'phone' | 'friends' | 'general' | 'privacy' | 'about'

const SECTIONS: ReadonlyArray<{ id: SectionId; icon: string; label: string; devOnly?: boolean }> = [
  { id: 'pet', icon: '🐱', label: 'My pet' },
  { id: 'features', icon: '✨', label: 'Features' },
  { id: 'daily', icon: '🌍', label: 'Daily life' },
  { id: 'claude', icon: '🤖', label: 'Claude Code', devOnly: true },
  { id: 'phone', icon: '📱', label: 'Phone ping', devOnly: true },
  { id: 'friends', icon: '👥', label: 'Friends' },
  { id: 'general', icon: '⚙️', label: 'General' },
  { id: 'privacy', icon: '🔒', label: 'Privacy & data' },
  { id: 'about', icon: 'ℹ️', label: 'About' }
]

function visibleSections(settings: PetSettings): typeof SECTIONS {
  return SECTIONS.filter((s) => !s.devOnly || settings.mode === 'developer')
}

/** "#settings:claude" -> "claude" */
function sectionFromHash(): SectionId {
  const id = location.hash.split(':')[1]
  return SECTIONS.some((s) => s.id === id) ? (id as SectionId) : 'pet'
}

export default function Settings(): React.JSX.Element {
  const loaded = useLoadedSettings()
  const [section, setSection] = useState<SectionId>(sectionFromHash)
  const [name, setName] = useState('Noodle')

  useEffect(() => {
    const unsubscribe = [
      window.api.onShowSection((id) => {
        if (SECTIONS.some((s) => s.id === id)) setSection(id as SectionId)
      }),
      window.api.onLook((look) => setName(look.petName))
    ]
    window.api.getLook().then((look) => setName(look.petName))
    return () => unsubscribe.forEach((off) => off())
  }, [])

  if (!loaded) return <div className="settings" />
  const settings = loaded

  const sections = visibleSections(settings)
  // switched to Fun & focus while on a developer section
  const current = sections.some((s) => s.id === section) ? section : 'general'

  let body: React.JSX.Element
  switch (current) {
    case 'pet':
      body = <PetSection settings={settings} />
      break
    case 'features':
      body = <FeaturesSection settings={settings} />
      break
    case 'daily':
      body = <DailySection settings={settings} />
      break
    case 'claude':
      body = <ClaudeSection settings={settings} name={name} />
      break
    case 'phone':
      body = <PhoneSection name={name} />
      break
    case 'friends':
      body = <FriendsSection settings={settings} />
      break
    case 'general':
      body = <GeneralSection settings={settings} />
      break
    case 'privacy':
      body = <PrivacySection settings={settings} />
      break
    case 'about':
      body = <AboutSection />
  }

  return (
    <div className="settings">
      <nav className="settings-nav">
        {sections.map((s) => (
          <button
            key={s.id}
            className={s.id === current ? 'active' : ''}
            title={s.label}
            onClick={() => setSection(s.id)}
          >
            <span className="settings-nav-icon">{s.icon}</span>
            <span className="settings-nav-label">{s.label}</span>
          </button>
        ))}
      </nav>
      <main className="settings-main">{body}</main>
    </div>
  )
}
