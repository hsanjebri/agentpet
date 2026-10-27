import type { PetLook, RareMoment } from '@shared/progress'
import { type PetSize, SIZE_SCALE } from '@shared/settings'
import type { SkinId } from '@shared/skins'
import type { Mood } from '../moods'
import type { Wearable } from './noodle/body'
import { Noodle } from './noodle/Noodle'
import type { CatSkin } from './noodle/palette'

interface Props {
  skin: SkinId
  /** S/M/L (Settings › My pet) */
  size?: PetSize
  mood: Mood
  look?: PetLook | null
  /** Friday! */
  partyHat?: boolean
  headphones?: boolean
  vibe?: 'groove' | 'still'
  flick?: number
  wiggle?: number
  walking?: boolean
  facing?: 'left' | 'right'
  rare?: RareMoment | null
  /** weather outfit, streak scarf… */
  extraWear?: readonly Wearable[]
}

const CATS: ReadonlySet<SkinId> = new Set<CatSkin>(['noodle', 'mochi', 'zitouna'])

/** Picks the skin and renders it in the given mood, at its current growth stage. */
export function Pet({
  skin,
  size = 'm',
  mood,
  look,
  partyHat,
  walking,
  facing,
  rare,
  headphones,
  vibe,
  flick,
  wiggle,
  extraWear = []
}: Props): React.JSX.Element {
  const wear: Wearable[] = [...(look?.wearing ?? [])]
  if (look?.stage === 'senior') wear.push('glasses')
  if (partyHat) wear.push('partyhat')
  if (headphones) wear.push('headphones')
  wear.push(...extraWear)

  return (
    <Noodle
      mood={mood}
      skin={CATS.has(skin) ? (skin as CatSkin) : 'noodle'}
      look={{ chonky: look?.stage === 'senior', wear }}
      walking={walking}
      facing={facing}
      rare={rare}
      vibe={vibe}
      flick={flick}
      wiggle={wiggle}
      // kittens are a size smaller
      scale={SIZE_SCALE[size] - (look?.stage === 'kitten' ? 1 : 0)}
    />
  )
}
