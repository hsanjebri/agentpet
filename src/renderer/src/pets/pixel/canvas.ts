// Pixel-art toolkit: a grid of palette keys (one character per color) with a 1-cell border
// so outlines can sit outside the drawing area. Shapes are tested at integer cell coordinates.

export const PAD = 1

export type Cell = string | null
export type Point = readonly [x: number, y: number]

export interface PixelMap {
  width: number
  height: number
  /** rows[y + PAD][x + PAD]; use the helpers below with drawing coordinates */
  rows: Cell[][]
}

/** One drawing layer; several frames are shown one after another (CSS-driven). */
export interface Layer {
  name: string // CSS class
  frames: PixelMap[]
  speed?: string // duration of one full frame cycle, e.g. "0.4s"
}

export function createMap(width: number, height: number): PixelMap {
  const rows = Array.from({ length: height + 2 * PAD }, () =>
    Array<Cell>(width + 2 * PAD).fill(null)
  )
  return { width, height, rows }
}

export function getCell(map: PixelMap, x: number, y: number): Cell {
  return map.rows[y + PAD]?.[x + PAD] ?? null
}

export function setCell(map: PixelMap, x: number, y: number, key: Cell): void {
  const row = map.rows[y + PAD]
  if (row && x + PAD >= 0 && x + PAD < row.length) row[x + PAD] = key
}

/** Visits every cell, including the border, in drawing coordinates. */
export function forEachCell(map: PixelMap, fn: (x: number, y: number, cell: Cell) => void): void {
  map.rows.forEach((row, ry) => row.forEach((cell, rx) => fn(rx - PAD, ry - PAD, cell)))
}

export function insideEllipse(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number
): boolean {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
}

export function fillEllipse(
  map: PixelMap,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  key: string
): void {
  forEachCell(map, (x, y) => {
    if (insideEllipse(x, y, cx, cy, rx, ry)) setCell(map, x, y, key)
  })
}

/** Fills the rectangle between two corners, both included. */
export function fillRect(
  map: PixelMap,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  key: string
): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setCell(map, x, y, key)
}

function insidePolygon(x: number, y: number, points: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function fillPolygon(map: PixelMap, points: readonly Point[], key: string): void {
  forEachCell(map, (x, y) => {
    if (insidePolygon(x, y, points)) setCell(map, x, y, key)
  })
}

/** Changes the color of already-filled cells where `where` is true (e.g. fur patches). */
export function recolor(
  map: PixelMap,
  key: string,
  where: (x: number, y: number) => boolean
): void {
  forEachCell(map, (x, y, cell) => {
    if (cell && where(x, y)) setCell(map, x, y, key)
  })
}

export function paint(map: PixelMap, key: string, points: readonly Point[]): void {
  for (const [x, y] of points) setCell(map, x, y, key)
}

/** Draws a small sprite written as text rows ("." = leave empty) with its top-left at (x, y). */
export function stamp(map: PixelMap, x: number, y: number, rows: readonly string[]): void {
  rows.forEach((row, dy) => {
    ;[...row].forEach((ch, dx) => {
      if (ch !== '.') setCell(map, x + dx, y + dy, ch)
    })
  })
}

/** Every cell on the line from a to b (Bresenham), both ends included. */
export function line([x0, y0]: Point, [x1, y1]: Point): Point[] {
  const points: Point[] = []
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0
  let y = y0
  for (;;) {
    points.push([x, y])
    if (x === x1 && y === y1) return points
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

/** Cells along a polyline, without repeating the shared corner cells. */
export function polyline(points: readonly Point[]): Point[] {
  const cells: Point[] = [points[0]]
  for (let i = 1; i < points.length; i++) cells.push(...line(points[i - 1], points[i]).slice(1))
  return cells
}

/** Rotates a point around `base` (degrees, clockwise on screen) and snaps it to the grid. */
export function rotateAround([x, y]: Point, [bx, by]: Point, degrees: number): Point {
  if (degrees === 0) return [x, y]
  const rad = (degrees * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [
    Math.round(bx + (x - bx) * cos - (y - by) * sin),
    Math.round(by + (x - bx) * sin + (y - by) * cos)
  ]
}

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
] as const

/** Copy of the map where every empty cell touching a filled one (up/down/left/right) is outline. */
export function withOutline(map: PixelMap, key = 'k'): PixelMap {
  const out = createMap(map.width, map.height)
  forEachCell(map, (x, y, cell) => {
    if (cell) setCell(out, x, y, cell)
    else if (NEIGHBORS.some(([dx, dy]) => getCell(map, x + dx, y + dy))) setCell(out, x, y, key)
  })
  return out
}

export interface Run {
  x: number
  y: number
  width: number
  key: string
}

/** Merges horizontal runs of the same color so the SVG needs far fewer <rect>s. */
export function toRuns(map: PixelMap): Run[] {
  const runs: Run[] = []
  map.rows.forEach((row, ry) => {
    let start = 0
    for (let rx = 1; rx <= row.length; rx++) {
      if (rx < row.length && row[rx] === row[start]) continue
      const key = row[start]
      if (key) runs.push({ x: start - PAD, y: ry - PAD, width: rx - start, key })
      start = rx
    }
  })
  return runs
}
