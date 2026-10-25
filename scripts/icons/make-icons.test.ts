// Draws AgentPet's icons from Noodle's own pixels: `npm run icons`.
// (Runs through Vitest so it can import the TypeScript pixel code without extra tools.)
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { deflateSync } from 'zlib'
import { it } from 'vitest'
import { buildHead } from '../../src/renderer/src/pets/noodle/body'
import { PALETTE } from '../../src/renderer/src/pets/noodle/palette'
import { getCell, withOutline } from '../../src/renderer/src/pets/pixel/canvas'

const ROOT = resolve(__dirname, '../..')
// Noodle's head (ears + outline, 33×29 cells) centered in a square
const HEAD = { x: 53, y: -3, size: 34 }
const TILE = '#3B4A63' // app icon background

type RGBA = [number, number, number, number]
const rgba = (hex: string, a = 255): RGBA => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
  a
]

function crc32(buf: Buffer): number {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}

function png(size: number, pixel: (x: number, y: number) => RGBA): Buffer {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) raw.set(pixel(x, y), y * (size * 4 + 1) + 1 + x * 4)
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const head = withOutline(buildHead('working'))

/** Noodle's head, nearest-neighbor scaled; `tile` adds a rounded background square. */
function icon(size: number, tile: boolean): Buffer {
  const margin = tile ? Math.round(size * 0.14) : 0
  const inner = size - 2 * margin
  const radius = size * 0.22
  return png(size, (x, y) => {
    const cx = Math.floor(((x - margin) / inner) * HEAD.size)
    const cy = Math.floor(((y - margin) / inner) * HEAD.size)
    const inside = x >= margin && y >= margin && x < size - margin && y < size - margin
    const cell = inside ? getCell(head, HEAD.x + cx, HEAD.y + cy) : null
    if (cell) return rgba(PALETTE[cell])
    if (!tile) return [0, 0, 0, 0]
    // rounded square background
    const dx = Math.max(radius - x, x - (size - 1 - radius), 0)
    const dy = Math.max(radius - y, y - (size - 1 - radius), 0)
    return dx * dx + dy * dy <= radius * radius ? rgba(TILE) : [0, 0, 0, 0]
  })
}

/** Windows .ico holding PNG images (supported since Vista). */
function ico(images: Array<[size: number, data: Buffer]>): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + 16 * images.length
  const entries = images.map(([size, data]) => {
    const e = Buffer.alloc(16)
    e[0] = size >= 256 ? 0 : size
    e[1] = size >= 256 ? 0 : size
    e.writeUInt16LE(1, 4) // planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    return e
  })
  return Buffer.concat([header, ...entries, ...images.map(([, data]) => data)])
}

it('makes the icons', () => {
  mkdirSync(resolve(ROOT, 'build'), { recursive: true })
  writeFileSync(resolve(ROOT, 'build/icon.png'), icon(1024, true)) // mac + linux (builder converts)
  writeFileSync(
    resolve(ROOT, 'build/icon.ico'),
    ico([16, 24, 32, 48, 64, 128, 256].map((s) => [s, icon(s, true)]))
  )
  rmSync(resolve(ROOT, 'build/icon.icns'), { force: true }) // regenerated from icon.png
  writeFileSync(resolve(ROOT, 'resources/icon.png'), icon(512, true)) // window icon (linux)
  writeFileSync(resolve(ROOT, 'resources/tray.png'), icon(32, false))
  writeFileSync(resolve(ROOT, 'resources/tray@2x.png'), icon(64, false))
})
