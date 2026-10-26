import { describe, expect, it } from 'vitest'
import { MOODS } from '../src/renderer/src/moods'
import { getCell, polyline, toRuns } from '../src/renderer/src/pets/pixel/canvas'
import { GRID_H, GRID_W, buildBody } from '../src/renderer/src/pets/noodle/body'
import { buildNoodle } from '../src/renderer/src/pets/noodle/layers'
import { PALETTE } from '../src/renderer/src/pets/noodle/palette'
import { TAIL_POSES, buildTailFrames } from '../src/renderer/src/pets/noodle/tail'

describe('Noodle', () => {
  it.each(MOODS)('%s: tail polyline runs from its base to its tip', (mood) => {
    const pose = TAIL_POSES[mood]
    const cells = polyline(pose)
    expect(cells[0]).toEqual(pose[0])
    expect(cells[cells.length - 1]).toEqual(pose[pose.length - 1])
  })

  it.each(MOODS)('%s: every layer stays inside the grid and uses palette colors', (mood) => {
    const { sprite, effects } = buildNoodle(mood)
    for (const layer of [...sprite, ...effects]) {
      for (const frame of layer.frames) {
        for (const run of toRuns(frame)) {
          expect(PALETTE[run.key], `color "${run.key}" in ${layer.name}`).toBeDefined()
          expect(run.x).toBeGreaterThanOrEqual(-1)
          expect(run.y).toBeGreaterThanOrEqual(-1)
          expect(run.x + run.width).toBeLessThanOrEqual(GRID_W + 1)
          expect(run.y).toBeLessThanOrEqual(GRID_H)
        }
      }
    }
  })

  it('needs: tail tip turns red', () => {
    const [frame] = buildTailFrames('needs')
    expect(getCell(frame, 21, 1)).toBe('r')
  })

  it('happy: farts a rainbow behind the body', () => {
    const { sprite } = buildNoodle('happy')
    expect(sprite.map((layer) => layer.name)).toEqual(['rainbow', 'tail', 'body'])
  })

  it('sleeping: the tail wraps in front of the body', () => {
    const { sprite } = buildNoodle('sleeping')
    expect(sprite.map((layer) => layer.name)).toEqual(['body', 'tail'])
  })

  it('stands on 4 legs, and lies down to sleep', () => {
    const standing = buildBody('working')
    // near and far legs reach the floor
    expect(getCell(standing, 63, 43)).toBe('w')
    expect(getCell(standing, 34, 43)).toBe('w')
    expect(getCell(standing, 70, 42)).toBe('g')
    expect(getCell(standing, 40, 42)).toBe('g')
    // lying: no legs under the back of the body
    expect(getCell(buildBody('sleeping'), 34, 44)).toBeNull()
  })

  it('has the black patch over the back ear and a pink nose', () => {
    const body = buildBody('working')
    expect(getCell(body, 58, 5)).toBe('d') // back ear
    expect(getCell(body, 70, 19)).toBe('p') // nose
  })
})

describe('mood demo', () => {
  it('shows every mood', async () => {
    const { DEMO_SEQUENCE } = await import('../src/renderer/src/demo')
    expect(new Set(DEMO_SEQUENCE.map((step) => step.mood))).toEqual(new Set(MOODS))
  })
})

describe('looks: growth, accessories, walking, rare moments', () => {
  const inBoundsWithPalette = (layers: ReturnType<typeof buildNoodle>): void => {
    for (const layer of [...layers.sprite, ...layers.effects]) {
      for (const frame of layer.frames) {
        for (const run of toRuns(frame)) {
          expect(PALETTE[run.key], `color "${run.key}" in ${layer.name}`).toBeDefined()
          expect(run.y).toBeGreaterThanOrEqual(-1)
          expect(run.x + run.width).toBeLessThanOrEqual(GRID_W + 1)
          expect(run.y).toBeLessThanOrEqual(GRID_H)
        }
      }
    }
  }

  it.each(MOODS)('%s: wears everything at once, chonky, and stays on the grid', (mood) => {
    inBoundsWithPalette(
      buildNoodle(mood, {
        look: { chonky: true, wear: ['tophat', 'crown', 'sunglasses', 'partyhat', 'glasses'] }
      })
    )
  })

  it('a top hat sits on his head, sunglasses over his eyes', () => {
    const body = buildBody('working', { wear: ['tophat', 'sunglasses'] })
    expect(getCell(body, 70, 2)).toBe('d') // hat crown above the head (head center 70,16)
    expect(getCell(body, 70, 4)).toBe('r') // hat band
    expect(getCell(body, 62, 15)).toBe('k') // lens over the left eye
  })

  it('senior cats are chonkier', () => {
    expect(getCell(buildBody('working'), 25, 29)).toBeNull()
    expect(getCell(buildBody('working', { chonky: true }), 25, 29)).not.toBeNull()
  })

  it('walking swings the legs between two frames', () => {
    const { sprite } = buildNoodle('working', { walking: true })
    const body = sprite.find((l) => l.name === 'body')!
    expect(body.frames).toHaveLength(2)
    expect(toRuns(body.frames[0])).not.toEqual(toRuns(body.frames[1]))
    inBoundsWithPalette(buildNoodle('sleeping', { walking: true }))
  })

  it.each(['golden', 'double', 'keyboard'] as const)('rare %s moment draws on the grid', (rare) => {
    inBoundsWithPalette(buildNoodle('happy', { rare }))
    inBoundsWithPalette(buildNoodle('sleeping', { rare }))
  })

  it('asleep on the keyboard adds a keyboard in front', () => {
    const names = buildNoodle('sleeping', { rare: 'keyboard' }).sprite.map((l) => l.name)
    expect(names).toEqual(['body', 'tail', 'keyboard'])
  })
})

describe('music looks', () => {
  it.each(MOODS)('%s: headphones stay on the grid with the real palette', (mood) => {
    for (const layer of buildNoodle(mood, { look: { wear: ['headphones', 'tophat'] } }).sprite) {
      for (const frame of layer.frames) {
        for (const run of toRuns(frame)) {
          expect(PALETTE[run.key]).toBeDefined()
          expect(run.x).toBeGreaterThanOrEqual(-1)
          expect(run.x + run.width).toBeLessThanOrEqual(GRID_W + 1)
        }
      }
    }
  })

  it('headphones: ear cups beside the head, band over it', () => {
    const body = buildBody('working', { wear: ['headphones'] })
    expect(getCell(body, 70 - 17, 14)).toBe('r') // left cup (head center 70,16)
    expect(getCell(body, 70 + 16, 14)).toBe('r') // right cup
    expect(getCell(body, 70, 5)).toBe('d') // band
  })

  it('vibing: standing, happy face, tail taps in two frames (paused: one)', () => {
    const groove = buildNoodle('sleeping', { vibe: 'groove' }).sprite
    expect(groove.map((l) => l.name)).toEqual(['tail', 'body'])
    expect(groove[0].frames).toHaveLength(2)
    expect(buildNoodle('sleeping', { vibe: 'still' }).sprite[0].frames).toHaveLength(1)
  })
})
