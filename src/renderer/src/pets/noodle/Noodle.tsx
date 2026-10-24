import './noodle.css'
import { useMemo } from 'react'
import type { Mood } from '../../moods'
import { PixelSprite } from '../pixel/PixelSprite'
import { GRID_H, GRID_W } from './body'
import { buildNoodle } from './layers'
import { PALETTE } from './palette'

interface Props {
  mood: Mood
  /** screen pixels per cell */
  scale?: number
}

export function Noodle({ mood, scale = 4 }: Props): React.JSX.Element {
  const layers = useMemo(() => buildNoodle(mood), [mood])
  return (
    <PixelSprite
      className={`noodle mood-${mood}`}
      width={GRID_W}
      height={GRID_H}
      scale={scale}
      palette={PALETTE}
      sprite={layers.sprite}
      effects={layers.effects}
    />
  )
}
