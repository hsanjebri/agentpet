// Noodle in the film: the app's own pixel art (buildNoodle), drawn as crisp SVG cells. The app
// animates frames with CSS; here the frame comes from the timeline, so renders are exact.
import { useCurrentFrame } from 'remotion'
import type { Mood } from '../../../src/renderer/src/moods'
import type { Wearable } from '../../../src/renderer/src/pets/noodle/body'
import { GRID_H, GRID_W, buildHead } from '../../../src/renderer/src/pets/noodle/body'
import { buildNoodle } from '../../../src/renderer/src/pets/noodle/layers'
import { CAT_PALETTES, type CatSkin } from '../../../src/renderer/src/pets/noodle/palette'
import {
  type Layer,
  PAD,
  getCell,
  toRuns,
  withOutline
} from '../../../src/renderer/src/pets/pixel/canvas'
import { FPS } from './config'

export type { CatSkin, Mood, Wearable }

interface Props {
  mood: Mood
  skin?: CatSkin
  /** screen pixels per cell: keep it an integer */
  scale?: number
  wear?: Wearable[]
  chonky?: boolean
  walking?: boolean
  vibe?: 'groove' | 'still'
  facing?: 'left' | 'right'
  /** freeze on this time (seconds) instead of the timeline (storyboard) */
  at?: number
}

function seconds(speed?: string): number {
  if (!speed) return 0.6
  const n = Number.parseFloat(speed)
  return speed.endsWith('ms') ? n / 1000 : n
}

function LayerCells({
  layer,
  t,
  palette
}: {
  layer: Layer
  t: number
  palette: Readonly<Record<string, string>>
}): React.JSX.Element {
  const n = layer.frames.length
  const i = n > 1 ? Math.floor((t / seconds(layer.speed)) * n) % n : 0
  return (
    <>
      {toRuns(layer.frames[i]).map((r) => (
        <rect
          key={`${layer.name}-${r.x},${r.y}`}
          x={r.x}
          y={r.y}
          width={r.width}
          height={1}
          fill={palette[r.key] ?? '#f0f'}
        />
      ))}
    </>
  )
}

export function Noodle({
  mood,
  skin = 'noodle',
  scale = 8,
  wear = [],
  chonky,
  walking,
  vibe,
  facing = 'right',
  at
}: Props): React.JSX.Element {
  const frame = useCurrentFrame()
  const t = at ?? frame / FPS
  const { sprite, effects } = buildNoodle(mood, { look: { wear, chonky }, walking, vibe })
  const w = GRID_W + 2 * PAD
  const h = GRID_H + 2 * PAD
  const palette = CAT_PALETTES[skin]
  return (
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={`${-PAD} ${-PAD} ${w} ${h}`}
      shapeRendering="crispEdges"
      style={{ display: 'block', transform: facing === 'left' ? 'scaleX(-1)' : undefined }}
    >
      {[...sprite, ...effects].map((layer) => (
        <LayerCells key={layer.name} layer={layer} t={t} palette={palette} />
      ))}
    </svg>
  )
}

/** Small pixel sprites (tomato, icons) from text rows. */
export function PixelRows({
  rows,
  palette,
  scale
}: {
  rows: readonly string[]
  palette: Record<string, string>
  scale: number
}): React.JSX.Element {
  const w = Math.max(...rows.map((r) => r.length))
  return (
    <svg
      width={w * scale}
      height={rows.length * scale}
      viewBox={`0 0 ${w} ${rows.length}`}
      shapeRendering="crispEdges"
      style={{ display: 'block' }}
    >
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === '.' ? null : (
            <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={palette[ch]} />
          )
        )
      )}
    </svg>
  )
}

/** Just his head, cropped like the app icon. */
export function NoodleHead({ scale = 8, skin = 'noodle' }: { scale?: number; skin?: CatSkin }) {
  const head = withOutline(buildHead('happy'))
  const crop = { x: 53, y: -3, size: 34 } // same crop as the app icon
  const palette = CAT_PALETTES[skin]
  const cells: React.JSX.Element[] = []
  for (let y = 0; y < crop.size; y++)
    for (let x = 0; x < crop.size; x++) {
      const key = getCell(head, crop.x + x, crop.y + y)
      if (key) cells.push(<rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={palette[key]} />)
    }
  return (
    <svg width={crop.size * scale} height={crop.size * scale} viewBox={`0 0 ${crop.size} ${crop.size}`} shapeRendering="crispEdges">
      {cells}
    </svg>
  )
}
