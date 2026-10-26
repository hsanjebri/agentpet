// Noodle's body: a chubby white cat on 4 legs (or lying down), black patches, and the face.
// He faces right: head on the right, tail on the left.
import type { Accessory } from '@shared/progress'
import type { Mood } from '../../moods'
import {
  type PixelMap,
  type Point,
  createMap,
  fillEllipse,
  fillPolygon,
  fillRect,
  forEachCell,
  insideEllipse,
  paint,
  polyline,
  recolor,
  setCell,
  stamp
} from '../pixel/canvas'

export const GRID_W = 88
export const GRID_H = 46

export type Pose = 'standing' | 'lying'

export const POSES: Record<Mood, Pose> = {
  sleeping: 'lying',
  working: 'standing',
  needs: 'standing',
  happy: 'standing',
  sweat: 'standing',
  sad: 'lying',
  hiss: 'standing'
}

/** Center of the head; the face is drawn relative to it. */
const HEAD: Record<Pose, Point> = { standing: [70, 16], lying: [70, 24] }
const BODY: Record<Pose, { cx: number; cy: number; rx: number; ry: number }> = {
  standing: { cx: 47, cy: 29, rx: 21, ry: 9.5 },
  lying: { cx: 47, cy: 36, rx: 21, ry: 7.5 }
}

/** Things the pet can wear: unlocked accessories, plus the Friday party hat and senior glasses. */
export type Wearable = Accessory | 'partyhat' | 'glasses' | 'headphones'

export interface BodyLook {
  /** the senior stage: a rounder, chonkier body */
  chonky?: boolean
  wear?: readonly Wearable[]
  /** walking: which way the legs are swinging (-1 / 1), 0 = standing still */
  stride?: -1 | 0 | 1
}

function bodyShape(pose: Pose, chonky = false): (typeof BODY)[Pose] {
  const b = BODY[pose]
  return chonky ? { ...b, rx: b.rx + 2.5, ry: b.ry + 1 } : b
}

/** Gray line along the bottom edge of a shape (jaw, belly). */
function shadeBottomEdge(map: PixelMap, inside: (x: number, y: number) => boolean): void {
  forEachCell(map, (x, y) => {
    if (inside(x, y) && !inside(x, y + 1)) setCell(map, x, y, 's')
  })
}

function drawBody(map: PixelMap, pose: Pose, { chonky, stride = 0 }: BodyLook): void {
  const b = bodyShape(pose, chonky)
  // walking: near and far legs swing opposite ways
  const swing = stride * 2
  const inBody = (x: number, y: number): boolean => insideEllipse(x, y, b.cx, b.cy, b.rx, b.ry)

  if (pose === 'standing') {
    // far-side legs, in shadow
    fillRect(map, 68 - swing, 33, 71 - swing, 42, 'g')
    fillRect(map, 39 + swing, 33, 42 + swing, 42, 'g')
    fillEllipse(map, b.cx, b.cy, b.rx, b.ry, 'w')
    fillEllipse(map, 66, 29, 8, 8, 'w') // chest
    shadeBottomEdge(map, inBody)
    // near-side legs, paws pointing forward
    fillRect(map, 61 + swing, 33, 65 + swing, 43, 'w')
    setCell(map, 66 + swing, 43, 'w')
    fillRect(map, 32 - swing, 33, 36 - swing, 43, 'w')
    setCell(map, 37 - swing, 43, 'w')
  } else {
    // loaf: legs tucked in, front paws peeking out under the chin
    fillEllipse(map, b.cx, b.cy, b.rx, b.ry, 'w')
    fillEllipse(map, 70, 37, 9, 6, 'w') // chest
    shadeBottomEdge(map, inBody)
    fillRect(map, 66, 40, 79, 43, 'w')
    paint(map, 's', [
      [73, 41],
      [73, 42],
      [73, 43]
    ])
  }

  // black patch on the back
  recolor(map, 'd', (x, y) => inBody(x, y) && insideEllipse(x, y, 41, b.cy - 8, 9, 4))
}

/** Hiss: fur stands up along the back. */
function drawBackFur(map: PixelMap, pose: Pose, chonky?: boolean): void {
  const b = bodyShape(pose, chonky)
  for (let x = 30; x <= 58; x += 3) {
    let top = b.cy
    while (insideEllipse(x, top - 1, b.cx, b.cy, b.rx, b.ry)) top--
    setCell(map, x, top - 1, 'w')
    setCell(map, x, top - 2, 'w')
  }
}

const HEAD_RX = 14.5
const HEAD_RY = 10.6

function drawHead(map: PixelMap, [hx, hy]: Point): void {
  const inHead = (x: number, y: number): boolean => insideEllipse(x, y, hx, hy, HEAD_RX, HEAD_RY)

  // tall pointy ears
  // prettier-ignore
  fillPolygon(map, [[hx - 14, hy - 5], [hx - 11, hy - 16], [hx - 3, hy - 10]], 'w')
  // prettier-ignore
  fillPolygon(map, [[hx + 14, hy - 5], [hx + 11, hy - 16], [hx + 3, hy - 10]], 'w')
  fillEllipse(map, hx, hy, HEAD_RX, HEAD_RY, 'w')
  shadeBottomEdge(map, inHead) // jaw line

  // black patch over the back ear and eye
  recolor(map, 'd', (x, y) => insideEllipse(x, y, hx - 11, hy - 8, 10, 9))
  // prettier-ignore
  fillPolygon(map, [[hx - 11, hy - 8], [hx - 10, hy - 13], [hx - 6, hy - 10]], 'p')
  // prettier-ignore
  fillPolygon(map, [[hx + 11, hy - 8], [hx + 10, hy - 13], [hx + 6, hy - 10]], 'p')
}

// Eye sprites. Shine is top-right on both eyes (same light source).
const EYE = ['.ee.', 'eeWe', 'eeee', '.ee.']
const BIG_EYE = ['.eee.', 'eeeWW', 'eeeWW', 'eeeee', '.eee.']
const NARROW_EYE = ['eeWe', 'eeee', '.ee.']
const CLOSED_EYE = ['k..k', '.kk.']
const HAPPY_EYE = ['.kk.', 'k..k']

function drawFace(map: PixelMap, mood: Mood, [hx, hy]: Point): void {
  /** Mirrors points from the left half of the face to the right half too. */
  const both = (points: Point[]): Point[] => [
    ...points,
    ...points.map(([x, y]): Point => [2 * hx - x, y])
  ]

  /** Both eyes, each on a small white ring so the one on the black patch still reads. */
  const eyes = (rows: string[], x: number, y: number): void => {
    const w = rows[0].length
    const h = rows.length
    for (const ex of [x, 2 * hx - x - (w - 1)]) {
      fillEllipse(map, ex + (w - 1) / 2, y + (h - 1) / 2, w / 2 + 0.6, h / 2 + 0.6, 'w')
      stamp(map, ex, y, rows)
    }
  }

  /** Wide flat smile with the corners turned up. */
  const smile = (half: number): void => {
    for (let x = hx - half; x <= hx + half; x++) setCell(map, x, hy + 6, 'k')
    paint(map, 'k', both([[hx - half - 1, hy + 5]]))
  }

  const lx = hx - 8 // left eye, top-left corner
  const ey = hy - 2
  // prettier-ignore
  const worried: Point[] = [[lx, ey - 2], [lx + 1, ey - 2], [lx + 2, ey - 3], [lx + 3, ey - 3]]
  // prettier-ignore
  const angry: Point[] = [[lx - 1, ey - 4], [lx, ey - 4], [lx + 1, ey - 3], [lx + 2, ey - 3], [lx + 3, ey - 2]]

  stamp(map, hx - 1, hy + 3, ['ppp', '.p.']) // nose

  switch (mood) {
    case 'sleeping':
      eyes(CLOSED_EYE, lx, hy - 1)
      smile(3)
      break
    case 'working': // the classic: small shiny eyes, wide calm smile
      eyes(EYE, lx, ey)
      smile(5)
      break
    case 'needs':
      eyes(BIG_EYE, hx - 9, hy - 3)
      stamp(map, hx - 1, hy + 5, ['.k.', 'kpk', 'kpk', '.k.']) // little "o"
      break
    case 'happy':
      eyes(HAPPY_EYE, lx, hy - 1)
      stamp(map, hx - 5, hy + 5, ['kkkkkkkkkkk', '.kkkkkkkkk.', '..kkpppkk..', '....kkk....'])
      break
    case 'sweat':
      eyes(EYE, lx, ey)
      paint(map, 'k', both(worried))
      for (let x = hx - 5; x <= hx + 5; x++) setCell(map, x, hy + 5 + ((x - hx) & 1), 'k')
      break
    case 'sad':
      eyes(EYE, lx, ey)
      paint(map, 'k', both(worried))
      // prettier-ignore
      paint(map, 'b', both([[lx, ey + 4], [lx, ey + 5], [lx, ey + 6]]))
      for (let x = hx - 3; x <= hx + 3; x++) setCell(map, x, hy + 5, 'k')
      paint(map, 'k', both([[hx - 4, hy + 6]]))
      break
    case 'hiss':
      eyes(NARROW_EYE, lx, hy - 1)
      paint(map, 'k', both(angry))
      stamp(map, hx - 4, hy + 4, ['kkkkkkkkk', 'kWkkkkkWk', 'kWkpppkWk', '.kkkkkkk.'])
      break
  }
}

// Accessories, placed relative to the head center like the face.
const TOP_HAT = ['..ddddddd..', '..ddddddd..', '..ddddddd..', '..rrrrrrr..', 'ddddddddddd']
const CROWN = ['y...y...y', 'yy.yyy.yy', 'yyyyyyyyy', 'yryyYyyry']
const PARTY_HAT = ['...r...', '...P...', '..PyP..', '..PPP..', '.PyPPP.', '.PPPPy.', 'PPyPPPP']
const SUNGLASSES_LENS = ['kkkkkk', 'kWkkkk', 'kkkkkk', 'kkkkkk', '.kkkk.']
const GLASSES_RING = ['.kkkk.', 'k....k', 'k....k', 'k....k', 'k....k', '.kkkk.']

// headphones: a band over the head, ear cups on both sides of it
const EAR_CUP = ['kk', 'rr', 'rr', 'rr', 'kk']

function drawHeadphones(map: PixelMap, [hx, hy]: Point): void {
  // prettier-ignore
  const band = polyline([[hx - 15, hy - 4], [hx - 14, hy - 8], [hx - 9, hy - 11], [hx + 9, hy - 11], [hx + 14, hy - 8], [hx + 15, hy - 4]])
  paint(map, 'd', band)
  stamp(map, hx - 17, hy - 4, EAR_CUP)
  stamp(map, hx + 16, hy - 4, EAR_CUP)
}

function drawWearables(map: PixelMap, [hx, hy]: Point, wear: readonly Wearable[]): void {
  if (wear.includes('headphones')) drawHeadphones(map, [hx, hy])
  // eyewear: sunglasses win over the senior's reading glasses
  const lens = wear.includes('sunglasses')
    ? SUNGLASSES_LENS
    : wear.includes('glasses')
      ? GLASSES_RING
      : null
  if (lens) {
    stamp(map, hx - 9, hy - 3, lens)
    stamp(map, hx + 4, hy - 3, lens)
    for (let x = hx - 3; x <= hx + 3; x++) setCell(map, x, hy - 2, 'k') // bridge
  }
  // headwear: one at a time (crown > top hat > party hat)
  if (wear.includes('crown')) stamp(map, hx - 4, hy - 14, CROWN)
  else if (wear.includes('tophat')) stamp(map, hx - 5, hy - 15, TOP_HAT)
  else if (wear.includes('partyhat')) stamp(map, hx - 3, hy - 16, PARTY_HAT)
}

/** Body, legs, head and the mood's face (not outlined yet). The tail is separate (tail.ts). */
export function buildBody(mood: Mood, look: BodyLook = {}): PixelMap {
  const map = createMap(GRID_W, GRID_H)
  const pose = POSES[mood]
  drawBody(map, pose, look)
  if (mood === 'hiss') drawBackFur(map, pose, look.chonky)
  drawHead(map, HEAD[pose])
  drawFace(map, mood, HEAD[pose])
  drawWearables(map, HEAD[pose], look.wear ?? [])
  return map
}

/** Just the head and face (for app and tray icons). */
export function buildHead(mood: Mood): PixelMap {
  const map = createMap(GRID_W, GRID_H)
  drawHead(map, HEAD.standing)
  drawFace(map, mood, HEAD.standing)
  return map
}
