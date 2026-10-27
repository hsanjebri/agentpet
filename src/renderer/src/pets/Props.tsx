// Little pixel props next to the pet: a glass of water, a prayer mat, a Ramadan lantern.
// Text sprites like everything else (one character per color, auto outline).
import { useMemo } from 'react'
import { PixelSprite } from './pixel/PixelSprite'
import { type Layer, createMap, stamp, withOutline } from './pixel/canvas'

const PALETTE = {
  k: '#1F1C1A',
  b: '#7FC8F8', // water
  B: '#4A9FE0',
  W: '#FFFFFF',
  g: '#2E8B57', // mat green
  G: '#1F6B42',
  y: '#F6C744', // gold
  Y: '#C98A12',
  r: '#E24B4A',
  o: '#FFB347' // lantern light
}

const SPRITES = {
  water: [
    'W........W',
    'W........W',
    'WbbbbbbbbW',
    'WbbbbbbbbW',
    'WbBbbbbbbW',
    'WbbbbbbbbW',
    'WbbbbbbBbW',
    '.WbbbbbbW.',
    '.WWWWWWWW.'
  ],
  mat: [
    'yGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGy',
    'GggggggggggggggggggggggggggggggG',
    'GgyyyggggggggggggggggggggggyyygG',
    'GgyggggggggggggggggggggggggggygG',
    'GggggggggggggggggggggggggggggggG',
    'yGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGy'
  ],
  lantern: [
    '...kk...',
    '...yy...',
    '..yyyy..',
    '.yYooYy.',
    '.yooooy.',
    '.yooooy.',
    '.yYooYy.',
    '..yyyy..',
    '...YY...'
  ]
} as const

export type PropName = keyof typeof SPRITES

export function Prop({ name, scale }: { name: PropName; scale: number }): React.JSX.Element {
  const rows = SPRITES[name]
  const width = Math.max(...rows.map((r) => r.length))
  const sprite = useMemo((): Layer[] => {
    const map = createMap(width, rows.length)
    stamp(map, 0, 0, rows)
    return [{ name: `prop-${name}`, frames: [withOutline(map)] }]
  }, [name, rows, width])
  return (
    <PixelSprite
      className={`prop prop-${name}`}
      width={width}
      height={rows.length}
      scale={scale}
      palette={PALETTE}
      sprite={sprite}
      effects={[]}
    />
  )
}
