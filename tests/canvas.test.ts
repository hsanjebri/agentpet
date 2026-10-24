import { describe, expect, it } from 'vitest'
import {
  createMap,
  fillPolygon,
  getCell,
  line,
  polyline,
  recolor,
  rotateAround,
  setCell,
  stamp,
  toRuns,
  withOutline
} from '../src/renderer/src/pets/pixel/canvas'

describe('line', () => {
  it('includes both ends', () => {
    expect(line([0, 0], [3, 0])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0]
    ])
  })

  it('draws diagonals one cell per step', () => {
    expect(line([0, 0], [2, 2])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2]
    ])
  })

  it('handles a zero-length line', () => {
    expect(line([5, 5], [5, 5])).toEqual([[5, 5]])
  })
})

describe('polyline', () => {
  it('does not repeat shared corners', () => {
    expect(
      polyline([
        [0, 0],
        [2, 0],
        [2, 2]
      ])
    ).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2]
    ])
  })
})

describe('rotateAround', () => {
  it('keeps the base fixed and rotates clockwise on screen', () => {
    expect(rotateAround([0, 0], [0, 0], 90)).toEqual([0, 0])
    expect(rotateAround([10, 0], [0, 0], 90)).toEqual([0, 10])
  })
})

describe('withOutline', () => {
  it('surrounds a single cell with 4 outline cells', () => {
    const map = createMap(10, 10)
    setCell(map, 5, 5, 'w')
    const out = withOutline(map)
    expect(getCell(out, 5, 5)).toBe('w')
    for (const [x, y] of [
      [4, 5],
      [6, 5],
      [5, 4],
      [5, 6]
    ]) {
      expect(getCell(out, x, y)).toBe('k')
    }
    expect(getCell(out, 4, 4)).toBeNull()
  })

  it('can outline outside the drawing area (into the border)', () => {
    const map = createMap(10, 10)
    setCell(map, 0, 0, 'w')
    expect(getCell(withOutline(map), -1, 0)).toBe('k')
  })
})

describe('shapes', () => {
  it('stamp skips "." cells', () => {
    const map = createMap(5, 5)
    stamp(map, 1, 1, ['a.b'])
    expect([getCell(map, 1, 1), getCell(map, 2, 1), getCell(map, 3, 1)]).toEqual(['a', null, 'b'])
  })

  it('fillPolygon fills the inside of a triangle', () => {
    const map = createMap(10, 10)
    fillPolygon(
      map,
      [
        [0, 0],
        [8, 0],
        [0, 8]
      ],
      'w'
    )
    expect(getCell(map, 2, 2)).toBe('w')
    expect(getCell(map, 7, 7)).toBeNull()
  })

  it('recolor only touches filled cells', () => {
    const map = createMap(5, 5)
    setCell(map, 1, 1, 'w')
    recolor(map, 'd', () => true)
    expect(getCell(map, 1, 1)).toBe('d')
    expect(getCell(map, 2, 2)).toBeNull()
  })
})

describe('toRuns', () => {
  it('merges same-colored neighbors in a row', () => {
    const map = createMap(5, 5)
    setCell(map, 1, 1, 'g')
    setCell(map, 2, 1, 'g')
    setCell(map, 3, 1, 's')
    expect(toRuns(map)).toEqual([
      { x: 1, y: 1, width: 2, key: 'g' },
      { x: 3, y: 1, width: 1, key: 's' }
    ])
  })
})
