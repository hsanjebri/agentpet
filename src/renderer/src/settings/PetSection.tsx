// Settings › My pet: name, skin, size, accessories, and how far you've come together.
import type { PetSettings, ProfileData } from '@shared/ipc'
import type { Accessory } from '@shared/progress'
import { SKINS } from '@shared/skins'
import { useEffect, useState } from 'react'
import { Noodle } from '../pets/noodle/Noodle'
import type { CatSkin } from '../pets/noodle/palette'
import { Choice, Group, Row, Section } from './controls'

const ACCESSORY_LABELS: Record<Accessory, string> = {
  tophat: '🎩 Top hat',
  sunglasses: '😎 Sunglasses',
  crown: '👑 Crown'
}

const STAGES = {
  kitten: 'kitten (grows up at level 5)',
  cat: 'cat (gets chonky at level 20)',
  senior: 'chonky senior cat with glasses'
}

export function PetSection({ settings }: { settings: PetSettings }): React.JSX.Element {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    const load = (): void =>
      void window.api.getProfile().then((p) => {
        setProfile(p)
        setName(p.look.petName)
      })
    load()
    return window.api.onLook(load)
  }, [])

  if (!profile) return <Section title="🐱 My pet">…</Section>
  const { look } = profile
  const wearing = look.wearing

  const saveName = (): void => {
    const clean = name.trim()
    if (clean && clean !== look.petName) window.api.setPetName(clean)
  }
  const toggle = (item: Accessory): void =>
    window.api.setWearing(
      wearing.includes(item) ? wearing.filter((a) => a !== item) : [...wearing, item]
    )

  return (
    <Section title="🐱 My pet">
      <div className="settings-pet-preview">
        <Noodle mood="working" skin={settings.skin as CatSkin} scale={2} />
      </div>

      <Row label="Name">
        <input
          className="settings-input"
          value={name}
          maxLength={24}
          placeholder="Noodle"
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && saveName()}
        />
      </Row>
      <Row label="Skin">
        <Choice
          value={settings.skin}
          options={SKINS.filter((s) => s.ready).map((s) => ({ value: s.id, label: s.name }))}
          onChange={(skin) => window.api.changeSettings({ skin })}
        />
      </Row>
      <Row label="Size" description="How big he is on your screen.">
        <Choice
          value={settings.size}
          options={[
            { value: 's', label: 'S' },
            { value: 'm', label: 'M' },
            { value: 'l', label: 'L' }
          ]}
          onChange={(size) => window.api.changeSettings({ size })}
        />
      </Row>

      <Group title="Accessories">
        {profile.unlocks.map(({ item, label, unlocked }) => (
          <label key={item} className={`settings-row${unlocked ? '' : ' disabled'}`}>
            <span className="settings-row-text">
              <b>{ACCESSORY_LABELS[item]}</b>
              <span className="connect-small">{unlocked ? 'unlocked' : `🔒 ${label}`}</span>
            </span>
            <input
              type="checkbox"
              className="switch"
              disabled={!unlocked}
              checked={wearing.includes(item)}
              onChange={() => toggle(item)}
            />
          </label>
        ))}
      </Group>

      <Group title="Together">
        <p>
          <b>Level {look.level}</b> · {STAGES[look.stage]}
        </p>
        <div className="usage-track profile-xp">
          <div className="usage-fill" style={{ width: `${look.levelProgress * 100}%` }} />
        </div>
        <p className="connect-small">🔥 {profile.streak}-day streak</p>
      </Group>
    </Section>
  )
}
