// Extras around Noodle: z Z, "!", sparkles… and the rainbow fart when a task is done.
import type { Mood } from '../../moods'
import {
  type Layer,
  type PixelMap,
  createMap,
  fillEllipse,
  setCell,
  stamp,
  withOutline
} from '../pixel/canvas'
import { GRID_H, GRID_W } from './body'

interface EffectSpec {
  name: string // CSS class that animates it
  x: number
  y: number
  rows: string[]
  outlined?: boolean
}

const PLUS = ['..y..', '..y..', 'yyyyy', '..y..', '..y..']

const EFFECTS: Record<Mood, EffectSpec[]> = {
  sleeping: [
    { name: 'z-small', x: 50, y: 14, rows: ['vvvv', '..v.', '.v..', 'vvvv'], outlined: true },
    {
      name: 'z-big',
      x: 42,
      y: 5,
      rows: ['vvvvvv', '....v.', '...v..', '..v...', '.v....', 'vvvvvv'],
      outlined: true
    }
  ],
  working: [{ name: 'steam', x: 18, y: 0, rows: ['.s.s', 's.s.', '.s.s'] }],
  needs: [
    {
      name: 'alert-mark',
      x: 13,
      y: 1,
      rows: ['rrr', 'rrr', 'rrr', 'rrr', 'rrr', '...', 'rrr'],
      outlined: true
    }
  ],
  happy: [
    { name: 'sparkle-a', x: 2, y: 1, rows: PLUS, outlined: true },
    { name: 'sparkle-b', x: 26, y: 4, rows: ['.p.', 'ppp', '.p.'], outlined: true },
    { name: 'sparkle-c', x: 32, y: 11, rows: ['.y.', 'yyy', '.y.'], outlined: true }
  ],
  sweat: [
    { name: 'sweat-drop', x: 51, y: 3, rows: ['.b.', '.b.', 'bbb', 'bbb', '.b.'], outlined: true }
  ],
  sad: [], // tears are part of the face
  hiss: [
    {
      name: 'lightning',
      x: 8,
      y: 3,
      rows: ['...rr', '..rr.', '.rrr.', '..rrr', '..rr.', '.rr..', 'rr...'],
      outlined: true
    }
  ]
}

export function buildEffects(mood: Mood): Layer[] {
  return EFFECTS[mood].map(({ name, x, y, rows, outlined }) => {
    const map = createMap(GRID_W, GRID_H)
    stamp(map, x, y, rows)
    return { name, frames: [outlined ? withOutline(map) : map] }
  })
}

const RAINBOW = ['r', 'o', 'y', 'G', 'B', 'P']
const GOLDEN = ['Y', 'y', 'W', 'y', 'Y', 'y'] // the rare golden fart
const RAINBOW_START_X = 27 // hidden under the butt
const RAINBOW_END_X = 9

/** The rainbow streaming out behind Noodle, ending in a little cloud puff. */
function drawRainbow(phase: number, kind: RainbowKind): PixelMap {
  const map = createMap(GRID_W, GRID_H)
  const colors = kind === 'golden' ? GOLDEN : RAINBOW
  // a double fart has a second stream right above the first
  const tops = kind === 'double' ? [28, 21] : [28]
  for (const base of tops) {
    for (let x = RAINBOW_START_X; x >= RAINBOW_END_X; x--) {
      const top = base + Math.round(Math.sin((RAINBOW_START_X - x) / 3 + phase))
      colors.forEach((color, band) => setCell(map, x, top + band, color))
    }
  }
  fillEllipse(map, 6, 30, 4, 3, 'W')
  fillEllipse(map, 3, 32, 3, 2.5, 'W')
  fillEllipse(map, 9, 33, 3, 2.2, 'W')
  return withOutline(map)
}

export type RainbowKind = 'normal' | 'golden' | 'double'

/** Two frames with the wave shifted, so the rainbow looks like it's flowing. */
export function buildRainbow(kind: RainbowKind = 'normal'): Layer {
  return {
    name: 'rainbow',
    frames: [drawRainbow(0, kind), drawRainbow(Math.PI, kind)],
    speed: '0.36s'
  }
}

/** Rare: fell asleep on the keyboard. Drawn in front of him, along the floor. */
export function buildKeyboard(): Layer {
  const map = createMap(GRID_W, GRID_H)
  stamp(map, 57, 44, ['s'.repeat(27), 'sW'.repeat(13) + 's'])
  return { name: 'keyboard', frames: [withOutline(map)] }
}
