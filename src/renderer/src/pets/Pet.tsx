import type { SkinId } from '@shared/skins'
import type { Mood } from '../moods'
import { Noodle } from './noodle/Noodle'
import type { CatSkin } from './noodle/palette'

interface Props {
  skin: SkinId
  mood: Mood
}

const CATS: ReadonlySet<SkinId> = new Set<CatSkin>(['noodle', 'mochi', 'zitouna'])

/** Picks the skin and renders it in the given mood. Byte, Ribbit and Bolt need their own art. */
export function Pet({ skin, mood }: Props): React.JSX.Element {
  return <Noodle mood={mood} skin={CATS.has(skin) ? (skin as CatSkin) : 'noodle'} />
}
