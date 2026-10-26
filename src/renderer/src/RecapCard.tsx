// A shareable recap image (today, or the weekly "Wrapped"), drawn on a canvas so it can be
// saved, copied and posted.
import type { Recap } from '@shared/progress'
import type { SkinId } from '@shared/skins'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { buildHead } from './pets/noodle/body'
import { CAT_PALETTES, type CatSkin } from './pets/noodle/palette'
import { getCell, withOutline } from './pets/pixel/canvas'

const W = 1200
const H = 680
const HEAD = { x: 53, y: -3, size: 34 } // same crop as the app icon

export interface RecapCardHandle {
  toPng(): string
}

const s = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** Fun & focus mode: only things you did together, no agent stats. */
function funLines(r: Recap): string[] {
  return [
    `🍅  ${s(r.pomodoros, 'focus session')}`,
    `🎵  ${s(r.songs, 'song')} vibed`,
    `❤️  petted ${s(r.pets, 'time')}`,
    `🐟  ${s(r.fish, 'fish')} fed`,
    r.title === 'Today'
      ? `🔥  ${s(r.streak, 'day')} in a row`
      : `📅  ${s(r.daysTogether, 'day')} together · 🔥 ${r.streak}-day streak`
  ]
}

function lines(r: Recap, fun: boolean): string[] {
  if (fun) return funLines(r)
  const focus = r.pomodoros ? [`🍅  ${s(r.pomodoros, 'focus session')}`] : []
  if (r.title === 'Today') {
    return [
      `🤖  Claude finished ${s(r.tasks, 'task')}`,
      `✏️  ${s(r.filesEdited, 'file')} edited`,
      `✅  you approved ${s(r.approvals, 'time')}`,
      `🌈  ${r.petName} farted ${s(r.rainbows, 'rainbow')}`,
      `🔥  ${s(r.streak, 'day')} in a row`,
      ...(r.songs ? [`🎵  ${s(r.songs, 'song')} vibed`] : []),
      ...focus
    ].slice(0, 7)
  }
  const scary = r.scariestMoment
  return [
    `📅  busiest day: ${r.busiestDay ?? '—'}`,
    `💛  favorite file: ${r.favoriteFile ?? '—'}`,
    scary
      ? `😾  scariest: ${scary.reason} at ${new Date(scary.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : '😺  no scary moments. nice.',
    `🌈  ${s(r.rainbows, 'rainbow')} · ✅ ${s(r.approvals, 'approval')}`,
    `🤖  ${s(r.tasks, 'task')} · 🔥 ${r.streak}-day streak`,
    ...(r.songs ? [`🎵  ${s(r.songs, 'song')} vibed`] : []),
    ...focus
  ].slice(0, 7)
}

function draw(ctx: CanvasRenderingContext2D, r: Recap, skin: SkinId, fun: boolean): void {
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#4a5a78')
  bg.addColorStop(1, '#232a3a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Noodle's head, pixel by pixel
  const palette =
    CAT_PALETTES[(['noodle', 'mochi', 'zitouna'].includes(skin) ? skin : 'noodle') as CatSkin]
  const head = withOutline(buildHead('happy'))
  const cell = 11
  const ox = 70
  const oy = (H - HEAD.size * cell) / 2
  for (let y = 0; y < HEAD.size; y++) {
    for (let x = 0; x < HEAD.size; x++) {
      const key = getCell(head, HEAD.x + x, HEAD.y + y)
      if (!key) continue
      ctx.fillStyle = palette[key]
      ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell)
    }
  }

  const text = (
    s: string,
    x: number,
    y: number,
    size: number,
    color: string,
    weight = 700
  ): void => {
    ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif, "Segoe UI Emoji", "Apple Color Emoji"`
    ctx.fillStyle = color
    ctx.fillText(s, x, y)
  }

  const left = 500
  const heading = r.title === 'Today' ? `Today with ${r.petName}` : `${r.petName} Wrapped`
  text(heading, left, 130, 58, '#ffffff', 800)
  const subtitle = fun
    ? r.title === 'Today'
      ? 'our day together'
      : 'our week together'
    : r.title === 'Today'
      ? 'your AI agent’s day'
      : 'your week with your AI agent'
  text(subtitle, left, 178, 28, '#c9d3e6', 500)
  lines(r, fun).forEach((line, i) => text(line, left, 262 + i * 60, 34, '#f6f2ea', 600))
  text(`AgentPet · ${r.petName} is level ${r.level}`, left, H - 40, 24, '#9fb0cc', 500)
}

export const RecapCard = forwardRef<RecapCardHandle, { recap: Recap; skin: SkinId; fun?: boolean }>(
  function RecapCard({ recap, skin, fun = false }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null)
    useImperativeHandle(ref, () => ({ toPng: () => canvas.current?.toDataURL('image/png') ?? '' }))
    useEffect(() => {
      const ctx = canvas.current?.getContext('2d')
      if (ctx) draw(ctx, recap, skin, fun)
    }, [recap, skin, fun])
    return <canvas ref={canvas} width={W} height={H} className="recap-card" />
  }
)
