// The pet's profile window (tray › "<name>'s profile & recap…"): daily recap, weekly Wrapped,
// and the pet himself: name, level, accessories, fish.
import type { ProfileData } from '@shared/ipc'
import { type Accessory, type Recap, shareText } from '@shared/progress'
import type { SkinId } from '@shared/skins'
import { useEffect, useRef, useState } from 'react'
import { RecapCard, type RecapCardHandle } from './RecapCard'

type Tab = 'today' | 'week' | 'pet'

const ACCESSORY_LABELS: Record<Accessory, string> = {
  tophat: '🎩 Top hat',
  sunglasses: '😎 Sunglasses',
  crown: '👑 Crown'
}

const STAGE_LABELS = {
  kitten: 'kitten 🐱 (grows up at level 5)',
  cat: 'cat 🐈 (gets chonky at level 20)',
  senior: 'chonky senior cat with glasses 🤓'
}

function ago(time: number): string {
  const hours = Math.round((Date.now() - time) / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}

function CardTab({
  recap,
  skin,
  fileName
}: {
  recap: Recap
  skin: SkinId
  fileName: string
}): React.JSX.Element {
  const card = useRef<RecapCardHandle>(null)
  const [note, setNote] = useState('')

  return (
    <>
      <RecapCard ref={card} recap={recap} skin={skin} />
      <div className="connect-actions">
        <button
          className="btn btn-approve"
          onClick={async () => {
            const path = await window.api.saveCard(card.current?.toPng() ?? '', fileName)
            if (path) setNote(`Saved to ${path}`)
          }}
        >
          Save image
        </button>
        <button
          className="btn btn-terminal"
          onClick={() => {
            window.api.copyCard(card.current?.toPng() ?? '')
            setNote('Image copied: paste it anywhere.')
          }}
        >
          Copy
        </button>
        <button
          className="btn btn-share"
          onClick={() => {
            // X can't take an image from a link: copy it so it can be pasted into the post
            window.api.copyCard(card.current?.toPng() ?? '')
            window.api.share(shareText(recap))
            setNote('Image copied: paste it into your post (Ctrl+V).')
          }}
        >
          Share on X
        </button>
      </div>
      {note && <p className="connect-small">{note}</p>}
    </>
  )
}

function PetTab({
  profile,
  onRename
}: {
  profile: ProfileData
  onRename(): void
}): React.JSX.Element {
  const [name, setName] = useState(profile.look.petName)
  const [wearing, setWearing] = useState(profile.look.wearing)
  const { look } = profile

  const toggle = (item: Accessory): void => {
    const next = wearing.includes(item) ? wearing.filter((a) => a !== item) : [...wearing, item]
    setWearing(next)
    window.api.setWearing(next)
  }

  return (
    <div className="profile-pet">
      <label className="profile-name">
        Name
        <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
        <button
          className="btn btn-approve"
          onClick={() => {
            window.api.setPetName(name)
            onRename()
          }}
        >
          Save
        </button>
      </label>

      <p>
        <b>Level {look.level}</b> · {STAGE_LABELS[look.stage]}
      </p>
      <div className="usage-track profile-xp">
        <div className="usage-fill" style={{ width: `${look.levelProgress * 100}%` }} />
      </div>

      <h2>Accessories</h2>
      <ul className="profile-unlocks">
        {profile.unlocks.map(({ item, label, unlocked }) => (
          <li key={item} className={unlocked ? '' : 'locked'}>
            <label>
              <input
                type="checkbox"
                disabled={!unlocked}
                checked={wearing.includes(item)}
                onChange={() => toggle(item)}
              />
              {ACCESSORY_LABELS[item]} {unlocked ? '' : `🔒 ${label}`}
            </label>
          </li>
        ))}
      </ul>

      <h2>Together</h2>
      <p>
        🤖 {profile.totals.tasks} tasks · ✅ {profile.totals.approvals} approvals · 🌈{' '}
        {profile.totals.rainbows} rainbows · 🔥 {profile.streak}-day streak
      </p>
      <p>
        🐟{' '}
        {profile.lastFedAt === null
          ? 'Every finished task feeds him a fish.'
          : look.hungry
            ? `Last fish ${ago(profile.lastFedAt)}: he's a bit hungry.`
            : `Last fish ${ago(profile.lastFedAt)}. Happy and fed.`}
      </p>
    </div>
  )
}

export default function Profile(): React.JSX.Element {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [skin, setSkin] = useState<SkinId>('noodle')
  const [tab, setTab] = useState<Tab>('today')

  const load = (): void => {
    window.api.getProfile().then((p) => {
      setProfile(p)
      document.title = `${p.look.petName}`
    })
  }
  useEffect(() => {
    load()
    window.api.getSettings().then((s) => setSkin(s.skin))
  }, [])

  if (!profile) return <div className="connect" />

  return (
    <div className="connect profile">
      <nav className="profile-tabs">
        {(['today', 'week', 'pet'] as const).map((t) => (
          <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'today' ? 'Today' : t === 'week' ? 'Weekly Wrapped' : profile.look.petName}
          </button>
        ))}
      </nav>
      {tab === 'today' && (
        <CardTab recap={profile.today} skin={skin} fileName="agentpet-today.png" />
      )}
      {tab === 'week' && (
        <CardTab recap={profile.week} skin={skin} fileName="agentpet-wrapped.png" />
      )}
      {tab === 'pet' && <PetTab profile={profile} onRename={load} />}
    </div>
  )
}
