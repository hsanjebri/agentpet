// The tiny pixel tomato kitchen timer he curls up on during a Pomodoro focus round. The dial
// notch walks around as the round goes by.
import { useMemo } from 'react'
import { PixelSprite } from './pixel/PixelSprite'
import { type Layer, createMap, stamp, withOutline } from './pixel/canvas'

const W = 16
const H = 13

const BODY = [
  '.......gg.......',
  '.....gggggg.....',
  '...rrrrggrrrr...',
  '..rrrrrrrrrrrr..',
  '.rrwrrrrrrrrrrr.',
  'rrwrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  '.rrrrrrrrrrrrrr.',
  '..rrrrrrrrrrrr..',
  '...rrrrrrrrrr...',
  '.....rrrrrr.....'
]

/** Where the dial notch sits for each eighth of the round (around the middle). */
const NOTCH: ReadonlyArray<[number, number]> = [
  [8, 4],
  [11, 5],
  [12, 7],
  [11, 9],
  [8, 10],
  [5, 9],
  [4, 7],
  [5, 5]
]

const PALETTE = {
  r: '#e2483d',
  g: '#4caf50',
  w: '#ffd2c8',
  d: '#7a1f1a',
  k: '#1f1c1a'
}

/** `progress` 0–1: how much of the round is done. */
export function Tomato({
  progress,
  scale
}: {
  progress: number
  scale: number
}): React.JSX.Element {
  const step = Math.min(NOTCH.length - 1, Math.floor(progress * NOTCH.length))
  const sprite = useMemo((): Layer[] => {
    const map = createMap(W, H)
    stamp(map, 0, 0, BODY)
    const [x, y] = NOTCH[step]
    stamp(map, x - 1, y, ['dd'])
    return [{ name: 'tomato', frames: [withOutline(map)] }]
  }, [step])

  return (
    <PixelSprite
      className="tomato"
      width={W}
      height={H}
      scale={scale}
      palette={PALETTE}
      sprite={sprite}
      effects={[]}
    />
  )
}
