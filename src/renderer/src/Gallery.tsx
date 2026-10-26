// Dev-only design sheet: every mood side by side. Open the renderer URL with #gallery
// (add "still" to switch the animations off, "mochi" / "zitouna" for another skin,
// "extras" for growth stages, accessories, walking and rare moments, "cards" for recap cards).
import type { PetLook, Recap } from '@shared/progress'
import type { SkinId } from '@shared/skins'
import { MOODS } from './moods'
import { Pet } from './pets/Pet'
import { RecapCard } from './RecapCard'

const look = (over: Partial<PetLook>): PetLook => ({
  petName: 'Noodle',
  level: 7,
  levelProgress: 0,
  stage: 'cat',
  wearing: [],
  hungry: false,
  ...over
})

const EXTRAS: Array<{ label: string; props: Partial<Parameters<typeof Pet>[0]> }> = [
  { label: 'kitten (lv 1–4)', props: { mood: 'working', look: look({ stage: 'kitten' }) } },
  { label: 'senior (lv 20+)', props: { mood: 'working', look: look({ stage: 'senior' }) } },
  { label: 'top hat', props: { mood: 'working', look: look({ wearing: ['tophat'] }) } },
  {
    label: 'crown + sunglasses',
    props: { mood: 'happy', look: look({ wearing: ['crown', 'sunglasses'] }) }
  },
  { label: 'friday party hat', props: { mood: 'needs', partyHat: true } },
  { label: 'walking', props: { mood: 'working', walking: true } },
  { label: 'golden rainbow', props: { mood: 'happy', rare: 'golden' } },
  { label: 'double fart', props: { mood: 'happy', rare: 'double' } },
  { label: 'asleep on the keyboard', props: { mood: 'sleeping', rare: 'keyboard' } }
]

const SAMPLE: Recap = {
  title: 'Today',
  petName: 'Noodle',
  level: 12,
  tasks: 23,
  approvals: 47,
  filesEdited: 84,
  rainbows: 24,
  favoriteFile: 'App.tsx',
  busiestDay: 'Tuesday',
  busiestHour: 15,
  scariestMoment: { reason: 'rm -rf', at: new Date(2026, 9, 21, 2, 13).getTime() },
  streak: 6,
  songs: 31
}

export default function Gallery(): React.JSX.Element {
  if (location.hash.includes('cards')) {
    return (
      <div className="gallery" style={{ flexDirection: 'column', width: 620 }}>
        <RecapCard recap={SAMPLE} skin="noodle" />
        <RecapCard recap={{ ...SAMPLE, title: 'This week' }} skin="mochi" />
      </div>
    )
  }
  const hash = location.hash
  const skin: SkinId = hash.includes('mochi')
    ? 'mochi'
    : hash.includes('zitouna')
      ? 'zitouna'
      : 'noodle'
  const tiles = hash.includes('extras')
    ? EXTRAS.map(({ label, props }) => ({
        label,
        props: { skin, mood: 'working' as const, ...props }
      }))
    : MOODS.map((mood) => ({ label: mood, props: { skin, mood } }))

  return (
    <div className={hash.includes('still') ? 'gallery still' : 'gallery'}>
      {tiles.map(({ label, props }, i) => (
        <figure key={label} className={i % 2 ? 'tile dark' : 'tile'}>
          <Pet {...props} />
          <figcaption>{label}</figcaption>
        </figure>
      ))}
    </div>
  )
}
