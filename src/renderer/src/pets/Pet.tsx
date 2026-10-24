import type { SkinId } from '@shared/skins'
import type { Mood } from '../moods'
import { Noodle } from './noodle/Noodle'

interface Props {
  skin: SkinId
  mood: Mood
}

/** Picks the skin and renders it in the given mood. More skins arrive in Phase 4. */
export function Pet({ mood }: Props): React.JSX.Element {
  return <Noodle mood={mood} />
}
