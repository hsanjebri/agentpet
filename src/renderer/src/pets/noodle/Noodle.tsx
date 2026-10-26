import './noodle.css'
import type { RareMoment } from '@shared/progress'
import { useMemo } from 'react'
import type { Mood } from '../../moods'
import { PixelSprite } from '../pixel/PixelSprite'
import { type BodyLook, GRID_H, GRID_W } from './body'
import { buildNoodle } from './layers'
import { CAT_PALETTES, type CatSkin } from './palette'

interface Props {
  mood: Mood
  skin?: CatSkin
  look?: BodyLook
  walking?: boolean
  facing?: 'left' | 'right'
  rare?: RareMoment | null
  vibe?: 'groove' | 'still'
  /** a quick tail flick (e.g. a music button was pressed); changes to replay it */
  flick?: number
  /** a happy wiggle (music resumed); changes to replay it */
  wiggle?: number
  /** screen pixels per cell */
  scale?: number
}

export function Noodle({
  mood,
  skin = 'noodle',
  look,
  walking,
  facing = 'right',
  rare,
  vibe,
  flick,
  wiggle,
  scale = 4
}: Props): React.JSX.Element {
  // the look object is rebuilt on every render by its owner: key the art on its contents
  const lookKey = JSON.stringify(look ?? {})
  const layers = useMemo(
    () => buildNoodle(mood, { look: JSON.parse(lookKey) as BodyLook, walking, rare, vibe }),
    [mood, walking, rare, vibe, lookKey]
  )
  return (
    // he is drawn facing right; walking left = mirror him
    <div style={facing === 'left' ? { transform: 'scaleX(-1)' } : undefined}>
      <PixelSprite
        className={[
          'noodle',
          `mood-${walking ? 'walking' : vibe ? `vibing-${vibe}` : mood}`,
          flick ? `flick-${flick % 2}` : '',
          wiggle ? `wiggle-${wiggle % 2}` : ''
        ].join(' ')}
        width={GRID_W}
        height={GRID_H}
        scale={scale}
        palette={CAT_PALETTES[skin]}
        sprite={layers.sprite}
        effects={layers.effects}
      />
    </div>
  )
}
