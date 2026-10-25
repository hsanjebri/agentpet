// Assembles every layer of Noodle for a mood, back to front.
import type { RareMoment } from '@shared/progress'
import type { Mood } from '../../moods'
import { type Layer, withOutline } from '../pixel/canvas'
import { type BodyLook, buildBody } from './body'
import { buildEffects, buildKeyboard, buildRainbow } from './effects'
import { TAIL_IN_FRONT, TAIL_MOTION, buildTailFrames } from './tail'

export interface NoodleLayers {
  sprite: Layer[] // moves with the pet, catches the mouse
  effects: Layer[]
}

export interface NoodleOptions {
  look?: BodyLook
  /** strolling along the screen: legs swing, eyes open, nothing in the tail */
  walking?: boolean
  rare?: RareMoment | null
}

export function buildNoodle(
  mood: Mood,
  { look = {}, walking, rare }: NoodleOptions = {}
): NoodleLayers {
  if (walking) {
    return {
      sprite: [
        {
          name: 'tail',
          frames: buildTailFrames('working', false)
            .slice(0, 1)
            .map((f) => withOutline(f))
        },
        {
          name: 'body',
          frames: [1, -1].map((stride) =>
            withOutline(buildBody('working', { ...look, stride: stride as 1 | -1 }))
          ),
          speed: '0.5s'
        }
      ],
      effects: []
    }
  }

  const tail: Layer = {
    name: 'tail',
    frames: buildTailFrames(mood).map((frame) => withOutline(frame)),
    speed: TAIL_MOTION[mood].speed
  }
  const body: Layer = { name: 'body', frames: [withOutline(buildBody(mood, look))] }

  const sprite = TAIL_IN_FRONT[mood] ? [body, tail] : [tail, body]
  if (mood === 'happy') {
    // behind everything, out of the butt
    sprite.unshift(
      buildRainbow(rare === 'golden' ? 'golden' : rare === 'double' ? 'double' : 'normal')
    )
  }
  if (mood === 'sleeping' && rare === 'keyboard') sprite.push(buildKeyboard())

  return { sprite, effects: buildEffects(mood) }
}
