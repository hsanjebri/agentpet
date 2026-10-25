// Dev-only design sheet: every mood side by side. Open the renderer URL with #gallery
// (add "still" to switch the animations off, "mochi" / "zitouna" for another skin).
import type { SkinId } from '@shared/skins'
import { MOODS } from './moods'
import { Pet } from './pets/Pet'

export default function Gallery(): React.JSX.Element {
  const skin: SkinId = location.hash.includes('mochi')
    ? 'mochi'
    : location.hash.includes('zitouna')
      ? 'zitouna'
      : 'noodle'
  return (
    <div className={location.hash.includes('still') ? 'gallery still' : 'gallery'}>
      {MOODS.map((mood, i) => (
        <figure key={mood} className={i % 2 ? 'tile dark' : 'tile'}>
          <Pet skin={skin} mood={mood} />
          <figcaption>{mood}</figcaption>
        </figure>
      ))}
    </div>
  )
}
