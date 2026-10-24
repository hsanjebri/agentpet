// Assembles every layer of Noodle for a mood, back to front.
import type { Mood } from '../../moods'
import { type Layer, withOutline } from '../pixel/canvas'
import { buildBody } from './body'
import { buildEffects, buildRainbow } from './effects'
import { TAIL_IN_FRONT, TAIL_MOTION, buildTailFrames } from './tail'

export interface NoodleLayers {
  sprite: Layer[] // moves with the pet, catches the mouse
  effects: Layer[]
}

export function buildNoodle(mood: Mood): NoodleLayers {
  const tail: Layer = {
    name: 'tail',
    frames: buildTailFrames(mood).map((frame) => withOutline(frame)),
    speed: TAIL_MOTION[mood].speed
  }
  const body: Layer = { name: 'body', frames: [withOutline(buildBody(mood))] }

  const sprite = TAIL_IN_FRONT[mood] ? [body, tail] : [tail, body]
  if (mood === 'happy') sprite.unshift(buildRainbow()) // behind everything, out of the butt

  return { sprite, effects: buildEffects(mood) }
}
