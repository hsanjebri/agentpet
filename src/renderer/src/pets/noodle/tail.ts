// The tail is the status display: one polyline per mood, 2 cells thick, dark tip.
// Animation frames rotate the polyline around its base and re-rasterize it, so it stays crisp.
import type { Mood } from '../../moods'
import {
  type PixelMap,
  type Point,
  createMap,
  polyline,
  rotateAround,
  setCell,
  stamp
} from '../pixel/canvas'
import { GRID_H, GRID_W } from './body'

// prettier-ignore
export const TAIL_POSES: Record<Mood, readonly Point[]> = {
  // wrapped around the front like a blanket
  sleeping: [[28, 34], [24, 38], [25, 42], [35, 43], [53, 43], [61, 42], [64, 40]],
  // raised, tip holds a tiny coffee mug
  working: [[28, 26], [23, 20], [20, 14], [20, 9]],
  // straight up like an antenna, red tip
  needs: [[28, 26], [23, 22], [21, 14], [21, 1]],
  // draws a heart in the air
  happy: [[28, 26], [22, 23], [16, 19], [21, 14], [21, 10], [19, 8], [17, 9], [16, 11], [15, 9], [13, 8], [11, 10], [11, 14], [15, 18]],
  // fans himself, tip holds a coin
  sweat: [[28, 26], [21, 21], [14, 17], [8, 15]],
  // lies flat on the floor, fully defeated
  sad: [[28, 34], [23, 40], [17, 42], [1, 42]],
  // puffed bottle brush
  hiss: [[28, 26], [23, 21], [22, 13], [22, 4]]
}

/** Drawn in front of the body instead of behind it. */
export const TAIL_IN_FRONT: Readonly<Partial<Record<Mood, true>>> = { sleeping: true }

/** Rotation (degrees, clockwise) of each animation frame, and how long one cycle takes. */
export const TAIL_MOTION: Record<Mood, { angles: number[]; speed?: string }> = {
  sleeping: { angles: [0] },
  working: { angles: [0, 4, 0, -4], speed: '2.4s' }, // sways while sipping
  needs: { angles: [0, 2, 0, -2], speed: '0.24s' }, // vibrates
  happy: { angles: [0, 5, 0, -5], speed: '0.45s' }, // wiggles
  sweat: { angles: [0, 6, 12, 6], speed: '0.36s' }, // fans
  sad: { angles: [0] },
  hiss: { angles: [0] } // the whole body shakes instead
}

const MUG = ['mccm..', 'mmmmm.', 'mmmm.m', 'mmmm.m', 'mmmmm.', 'mmmm..']
const COIN = ['.yy.', 'yYYy', 'yYYy', '.yy.']

/** Things the tip holds. They move with the tail, so they belong to the tail layer. */
const TIP_PROPS: Partial<Record<Mood, (map: PixelMap, tip: Point) => void>> = {
  working: (map, [x, y]) => stamp(map, x - 2, y - 6, MUG),
  sweat: (map, [x, y]) => stamp(map, x - 4, y - 4, COIN)
}

function drawTail(mood: Mood, pose: readonly Point[], props: boolean): PixelMap {
  const map = createMap(GRID_W, GRID_H)
  const cells = polyline(pose)
  const puffed = mood === 'hiss'
  const brush = puffed ? [-1, 0, 1, 2] : [0, 1]
  const tipLength = mood === 'needs' ? 3 : 4
  const tipColor = mood === 'needs' ? 'r' : 'd'

  cells.forEach(([x, y], i) => {
    const color = i >= cells.length - tipLength ? tipColor : 'w'
    for (const dx of brush) for (const dy of brush) setCell(map, x + dx, y + dy, color)

    // hiss: tufts of fur sticking out on both sides
    if (puffed && i % 3 === 0) {
      const [px, py] = cells[Math.max(i - 1, 0)]
      const [nx, ny] = cells[Math.min(i + 1, cells.length - 1)]
      const vertical = Math.abs(ny - py) >= Math.abs(nx - px)
      if (vertical) {
        setCell(map, x - 2, y, color)
        setCell(map, x + 3, y, color)
      } else {
        setCell(map, x, y - 2, color)
        setCell(map, x, y + 3, color)
      }
    }
  })

  if (props) TIP_PROPS[mood]?.(map, cells[cells.length - 1])
  return map
}

/** One map per animation frame (not outlined yet). `props`: draw what the tip holds;
 *  `angles` overrides the mood's motion (e.g. tapping along to music). */
export function buildTailFrames(
  mood: Mood,
  props = true,
  angles: readonly number[] = TAIL_MOTION[mood].angles
): PixelMap[] {
  const pose = TAIL_POSES[mood]
  return angles.map((angle) =>
    drawTail(
      mood,
      pose.map((p) => rotateAround(p, pose[0], angle)),
      props
    )
  )
}
