import type { PetLook, RareMoment } from '@shared/progress'
import type { SkinId } from '@shared/skins'
import type { Mood } from '../moods'
import type { Wearable } from './noodle/body'
import { Noodle } from './noodle/Noodle'
import type { CatSkin } from './noodle/palette'

interface Props {
  skin: SkinId
  mood: Mood
  look?: PetLook | null
  /** Friday! */
  partyHat?: boolean
  walking?: boolean
  facing?: 'left' | 'right'
  rare?: RareMoment | null
}

const CATS: ReadonlySet<SkinId> = new Set<CatSkin>(['noodle', 'mochi', 'zitouna'])

/** Picks the skin and renders it in the given mood, at its current growth stage. */
export function Pet({
  skin,
  mood,
  look,
  partyHat,
  walking,
  facing,
  rare
}: Props): React.JSX.Element {
  const wear: Wearable[] = [...(look?.wearing ?? [])]
  if (look?.stage === 'senior') wear.push('glasses')
  if (partyHat) wear.push('partyhat')

  return (
    <Noodle
      mood={mood}
      skin={CATS.has(skin) ? (skin as CatSkin) : 'noodle'}
      look={{ chonky: look?.stage === 'senior', wear }}
      walking={walking}
      facing={facing}
      rare={rare}
      // kittens are smaller
      scale={look?.stage === 'kitten' ? 3 : 4}
    />
  )
}
