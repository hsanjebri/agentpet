// The film's vector world (smooth rounded shapes, soft shadows) around the pixel cat, plus the
// short UI moments: simplified, not screenshots.
import type { CSSProperties, ReactNode } from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BEAT, CONFIG } from './config'
import { PixelRows } from './Noodle'

const C = CONFIG.colors
export const FONT = '"Segoe UI", "SF Pro Display", system-ui, sans-serif'
export const MONO = '"Cascadia Mono", "SF Mono", Consolas, ui-monospace, monospace'

export function useLayout(): { w: number; h: number; vertical: boolean } {
  const { width, height } = useVideoConfig()
  return { w: width, h: height, vertical: height > width }
}

/** A spring that starts at `delay` frames (local to the scene). */
export function useSpring(delay = 0, damping = 14, mass = 0.7): number {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config: { damping, mass } })
}

/** Soft gradient sky with slow-drifting blobs (parallax). `night` 0..1 fades to dark. */
export function Backdrop({ night = 0, tint = C.peach }: { night?: number; tint?: string }) {
  const frame = useCurrentFrame()
  const { w, h } = useLayout()
  const day = `radial-gradient(120% 90% at 30% 20%, ${C.cream} 0%, ${tint} 100%)`
  const dark = `radial-gradient(120% 90% at 70% 10%, ${C.night} 0%, ${C.nightDeep} 100%)`
  const blobs: Array<[number, number, number, string, number]> = [
    [0.12, 0.2, 0.22, C.mint, 0.25],
    [0.85, 0.25, 0.18, C.lilac, 0.4],
    [0.75, 0.85, 0.26, C.sky, 0.15],
    [0.2, 0.9, 0.16, C.butter, 0.3]
  ]
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: day }} />
      <div style={{ position: 'absolute', inset: 0, background: dark, opacity: night }} />
      {blobs.map(([x, y, r, color, speed], i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x * w + Math.sin(frame / 90 + i) * 30 * speed * 4,
            top: y * h + Math.cos(frame / 110 + i) * 24 * speed * 4,
            width: r * Math.max(w, h),
            height: r * Math.max(w, h),
            marginLeft: (-r * Math.max(w, h)) / 2,
            marginTop: (-r * Math.max(w, h)) / 2,
            borderRadius: '50%',
            background: color,
            opacity: 0.55 * (1 - night) + 0.08 * night,
            filter: 'blur(2px)'
          }}
        />
      ))}
      {night > 0 &&
        Array.from({ length: 40 }, (_, i) => (
          <div
            key={`s${i}`}
            style={{
              position: 'absolute',
              left: ((i * 397) % 1000) / 1000 * w,
              top: ((i * 613) % 1000) / 1000 * h * 0.7,
              width: 4,
              height: 4,
              background: C.yellow,
              opacity: night * (0.5 + 0.5 * Math.sin(frame / 20 + i))
            }}
          />
        ))}
    </div>
  )
}

/** A floating rounded card with a soft shadow and a slow 3D tilt. */
export function Card({
  children,
  style,
  tilt = 6,
  dark = false
}: {
  children?: ReactNode
  style?: CSSProperties
  tilt?: number
  dark?: boolean
}) {
  const frame = useCurrentFrame()
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: 28,
        background: dark ? '#2E3558' : C.white,
        boxShadow: '0 30px 60px rgba(31,28,26,0.16), 0 6px 14px rgba(31,28,26,0.08)',
        transform: `perspective(1400px) rotateY(${Math.sin(frame / 80) * tilt}deg) rotateX(${
          Math.cos(frame / 95) * tilt * 0.6
        }deg)`,
        overflow: 'hidden',
        ...style
      }}
    >
      {children}
    </div>
  )
}

/** Window chrome: three dots and an optional title. */
export function WindowBar({ title, dark = false }: { title?: string; dark?: boolean }) {
  return (
    <div
      style={{
        height: 46,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 20px',
        background: dark ? '#262C4A' : '#F4EEE6',
        fontFamily: MONO,
        fontSize: 18,
        color: dark ? '#AEB6D8' : C.inkSoft
      }}
    >
      {[C.red, C.yellow, C.green].map((c) => (
        <span key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
      ))}
      <span style={{ marginLeft: 12 }}>{title}</span>
    </div>
  )
}

/** Big bold words that pop in one by one on the beat. */
export function Headline({
  text,
  delay = 0,
  size = 120,
  color = C.ink,
  style
}: {
  text: string
  delay?: number
  size?: number
  color?: string
  style?: CSSProperties
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.split(' ')
  return (
    <div
      style={{
        position: 'absolute',
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.02,
        letterSpacing: -size * 0.03,
        color,
        display: 'flex',
        flexWrap: 'wrap',
        gap: `0 ${size * 0.28}px`,
        ...style
      }}
    >
      {words.map((word, i) => {
        const s = spring({
          frame: frame - delay - i * (BEAT / 2),
          fps,
          config: { damping: 11, mass: 0.6 }
        })
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `translateY(${(1 - s) * size * 0.6}px) scale(${0.6 + 0.4 * s})`,
              opacity: Math.min(1, s * 1.6)
            }}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}

// ---------- UI moments ----------

const btn = (bg: string): CSSProperties => ({
  padding: '10px 26px',
  borderRadius: 14,
  border: `3px solid ${C.ink}`,
  boxShadow: `4px 4px 0 ${C.ink}`,
  background: bg,
  fontFamily: MONO,
  fontWeight: 800,
  fontSize: 26,
  color: C.ink
})

/** The Approve / Deny bubble, simplified. `pressed` 0..1 animates the Approve press. */
export function ApproveBubble({ pressed = 0, style }: { pressed?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        padding: '22px 26px',
        borderRadius: 22,
        border: `4px solid ${C.ink}`,
        boxShadow: `6px 6px 0 ${C.ink}`,
        background: '#FFFDF8',
        fontFamily: MONO,
        fontSize: 26,
        color: C.ink,
        ...style
      }}
    >
      <div style={{ fontWeight: 800 }}>🐱 Claude wants to run</div>
      <div style={{ margin: '8px 0 18px', color: C.inkSoft }}>$ {CONFIG.text.command}</div>
      <div style={{ display: 'flex', gap: 14 }}>
        <span
          style={{
            ...btn(C.green),
            transform: `translate(${pressed * 4}px, ${pressed * 4}px)`,
            boxShadow: `${4 - pressed * 4}px ${4 - pressed * 4}px 0 ${C.ink}`
          }}
        >
          Approve
        </span>
        <span style={btn('#F2A0A8')}>Deny</span>
      </div>
    </div>
  )
}

const TOMATO = [
  '.......gg.......',
  '.....gggggg.....',
  '...rrrrggrrrr...',
  '..rrrrrrrrrrrr..',
  '.rrwrrrrrrrrrrr.',
  'rrwrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  '.rrrrrrrrrrrrrr.',
  '..rrrrrrrrrrrr..',
  '...rrrrrrrrrr...',
  '.....rrrrrr.....'
]

export function Tomato({ scale = 8 }: { scale?: number }) {
  return (
    <PixelRows
      rows={TOMATO}
      palette={{ r: '#E2483D', g: '#4CAF50', w: '#FFD2C8' }}
      scale={scale}
    />
  )
}

/** "25:00" counting down fast. */
export function Timer({ progress, style }: { progress: number; style?: CSSProperties }) {
  const total = 25 * 60
  const left = Math.max(0, Math.round(total * (1 - progress)))
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  return (
    <div
      style={{
        position: 'absolute',
        fontFamily: MONO,
        fontWeight: 800,
        fontSize: 64,
        color: C.ink,
        padding: '8px 22px',
        borderRadius: 18,
        background: C.white,
        border: `4px solid ${C.ink}`,
        boxShadow: `5px 5px 0 ${C.ink}`,
        ...style
      }}
    >
      🍅 {mm}:{ss}
    </div>
  )
}

const ICON = {
  prev: ['k....k', 'k...kk', 'k..kkk', 'k.kkkk', 'k..kkk', 'k...kk', 'k....k'],
  pause: ['kk..kk', 'kk..kk', 'kk..kk', 'kk..kk', 'kk..kk', 'kk..kk', 'kk..kk'],
  next: ['k....k', 'kk...k', 'kkk..k', 'kkkk.k', 'kkk..k', 'kk...k', 'k....k']
}

export function MusicBubble({ style }: { style?: CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        padding: '20px 24px',
        borderRadius: 22,
        border: `4px solid ${C.ink}`,
        boxShadow: `6px 6px 0 ${C.ink}`,
        background: '#FFFDF8',
        fontFamily: MONO,
        color: C.ink,
        ...style
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 800 }}>♪ {CONFIG.text.song.title}</div>
      <div style={{ fontSize: 22, color: C.inkSoft, margin: '4px 0 14px' }}>
        {CONFIG.text.song.artist} · Spotify
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {[ICON.prev, ICON.pause, ICON.next].map((rows, i) => (
          <span key={i} style={{ ...btn('#FFFDF8'), padding: '10px 16px' }}>
            <PixelRows rows={rows} palette={{ k: C.ink }} scale={4} />
          </span>
        ))}
      </div>
    </div>
  )
}

export function Terminal({ lines, style }: { lines: string[]; style?: CSSProperties }) {
  return (
    <Card dark style={{ width: 640, height: 360, ...style }}>
      <WindowBar title="claude — my-app" dark />
      <div
        style={{
          padding: '22px 26px',
          fontFamily: MONO,
          fontSize: 24,
          lineHeight: 1.6,
          color: '#D9DEF5'
        }}
      >
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.startsWith('>') ? C.yellow : undefined }}>
            {l}
          </div>
        ))}
      </div>
    </Card>
  )
}

export function Phone({ style }: { style?: CSSProperties }) {
  const p = CONFIG.text.phone
  return (
    <div
      style={{
        position: 'absolute',
        width: 300,
        height: 600,
        borderRadius: 48,
        background: C.ink,
        padding: 14,
        boxShadow: '0 30px 60px rgba(0,0,0,0.25)',
        ...style
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 36,
          background: `linear-gradient(160deg, ${C.lilac}, ${C.sky})`,
          padding: '70px 14px'
        }}
      >
        <div
          style={{
            borderRadius: 20,
            background: 'rgba(255,255,255,0.92)',
            padding: '14px 16px',
            fontFamily: FONT,
            color: C.ink
          }}
        >
          <div style={{ fontSize: 15, opacity: 0.6 }}>🐱 {p.app} · now</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{p.title}</div>
          <div style={{ fontSize: 17, marginTop: 2 }}>{p.body}</div>
        </div>
      </div>
    </div>
  )
}

export function RecapCard({ style }: { style?: CSSProperties }) {
  return (
    <Card style={{ width: 620, padding: 40, background: '#2E3558', ...style }} tilt={4}>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 52, color: C.white }}>
        Noodle Wrapped
      </div>
      <div style={{ fontFamily: FONT, fontSize: 24, color: '#AEB6D8', marginBottom: 24 }}>
        your week together
      </div>
      {CONFIG.text.recap.map((line, i) => (
        <div
          key={line}
          style={{
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 34,
            color: '#F6F2EA',
            marginTop: 12
          }}
        >
          {['🍅', '🎵', '🤖'][i]} {line}
        </div>
      ))}
    </Card>
  )
}

/** A morphing shape: rounded rectangle that blooms (scale + corner radius). */
export function Bloom({
  progress,
  width,
  height,
  color,
  style
}: {
  progress: number
  width: number
  height: number
  color: string
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        position: 'absolute',
        width: interpolate(progress, [0, 1], [80, width]),
        height: interpolate(progress, [0, 1], [80, height]),
        borderRadius: interpolate(progress, [0, 1], [40, 28]),
        background: color,
        boxShadow: '0 30px 60px rgba(31,28,26,0.14)',
        transform: 'translate(-50%, -50%)',
        ...style
      }}
    />
  )
}
