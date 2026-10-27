// "A day with Noodle": the seven scenes. Each uses frames local to its own <Sequence>.
// Positions come from the frame size, so the same scenes lay out for 16:9 and 9:16.
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { CONFIG, beats, sec } from '../config'
import { Noodle, NoodleHead, type Wearable } from '../Noodle'
import {
  ApproveBubble,
  Backdrop,
  Bloom,
  Card,
  FONT,
  Headline,
  MONO,
  MusicBubble,
  Phone,
  RecapCard,
  Terminal,
  Timer,
  Tomato,
  WindowBar,
  useLayout,
  useSpring
} from '../ui'

const C = CONFIG.colors
const T = CONFIG.text
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** Text size and cat scale that fit the frame (1080 = the short side of 16:9). */
function useSizes(): { k: number; head: number; cat: number } {
  const { w, h } = useLayout()
  const k = Math.min(w, h) / 1080
  return { k, head: Math.round(120 * k), cat: Math.max(4, Math.round(8 * k)) }
}

function Centered({
  x,
  y,
  children,
  style
}: {
  x: number
  y: number
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', ...style }}>
      {children}
    </div>
  )
}

// ---------- 1. Morning: a window blooms open, Noodle drops in and stretches ----------

export function Morning() {
  const f = useCurrentFrame()
  const { w, h, vertical } = useLayout()
  const { head, cat } = useSizes()
  const bloom = useSpring(beats(0.5), 16)
  const drop = useSpring(beats(2), 9, 0.9)
  const stretching = f > beats(3.5) && f < beats(5.5)
  const mood = f < beats(3.5) ? 'sleeping' : 'working'
  const catY = interpolate(drop, [0, 1], [-h * 0.4, h * (vertical ? 0.47 : 0.5)])
  return (
    <AbsoluteFill>
      <Backdrop />
      <Bloom
        progress={bloom}
        width={w * (vertical ? 0.86 : 0.56)}
        height={h * (vertical ? 0.34 : 0.5)}
        color={C.white}
        style={{ left: w / 2, top: h * (vertical ? 0.47 : 0.5) }}
      />
      <Centered x={w / 2} y={catY}>
        <div
          style={{
            transform: stretching
              ? `scale(${1 + 0.1 * Math.sin(((f - beats(3.5)) / beats(2)) * Math.PI)}, ${
                  1 - 0.08 * Math.sin(((f - beats(3.5)) / beats(2)) * Math.PI)
                })`
              : undefined,
            transformOrigin: '50% 100%'
          }}
        >
          <Noodle mood={mood} scale={cat} />
        </div>
      </Centered>
      <Headline
        text={T.morning}
        delay={beats(5)}
        size={head}
        style={{
          left: 0,
          right: 0,
          justifyContent: 'center',
          top: vertical ? h * 0.18 : h * 0.1
        }}
      />
    </AbsoluteFill>
  )
}

// ---------- 2. Focus: hops across windows, his tail draws the path into a tomato timer ----------

export function Focus() {
  const f = useCurrentFrame()
  const { w, h, vertical } = useLayout()
  const { head, cat, k } = useSizes()
  const windows = vertical
    ? [
        [0.3, 0.42],
        [0.7, 0.55],
        [0.35, 0.7]
      ]
    : [
        [0.22, 0.58],
        [0.5, 0.42],
        [0.78, 0.6]
      ]
  const hopEnd = beats(5)
  const p = interpolate(f, [beats(1), hopEnd], [0, 1], clamp)
  const seg = Math.min(windows.length - 2, Math.floor(p * (windows.length - 1)))
  const local = p * (windows.length - 1) - seg
  const [x0, y0] = windows[seg]
  const [x1, y1] = windows[seg + 1]
  const catX = (x0 + (x1 - x0) * local) * w
  const catY = (y0 + (y1 - y0) * local) * h - Math.sin(local * Math.PI) * h * 0.12 - 90 * k
  const curled = f > hopEnd
  const timer = interpolate(f, [hopEnd + beats(1), sec(6)], [0, 0.75], clamp)
  const tomato = useSpring(hopEnd)
  const path = windows.map(([x, y]) => `${x * w},${y * h - 30 * k}`).join(' L ')
  return (
    <AbsoluteFill>
      <Backdrop tint={C.mint} />
      {windows.map(([x, y], i) => (
        <Card
          key={i}
          style={{
            left: x * w - 220 * k,
            top: y * h - 20 * k,
            width: 440 * k,
            height: 260 * k
          }}
        >
          <WindowBar title={['notes.md', 'lecture.pdf', 'essay.docx'][i]} />
          {[0.8, 0.6, 0.7, 0.4].map((wd, j) => (
            <div
              key={j}
              style={{
                margin: `${16 * k}px ${22 * k}px 0`,
                height: 14 * k,
                width: `${wd * 100}%`,
                borderRadius: 7,
                background: '#EDE6DC'
              }}
            />
          ))}
        </Card>
      ))}
      {/* his tail draws the path he hopped */}
      <svg style={{ position: 'absolute', inset: 0 }} width={w} height={h}>
        <path
          d={`M ${path}`}
          fill="none"
          stroke={C.red}
          strokeWidth={10 * k}
          strokeLinecap="round"
          strokeDasharray="4000"
          strokeDashoffset={4000 * (1 - p)}
          opacity={1 - tomato}
        />
      </svg>
      {curled ? (
        <>
          <Centered x={windows[2][0] * w + 30 * k} y={windows[2][1] * h - 150 * k}>
            <Noodle mood="sleeping" scale={cat} />
          </Centered>
          <Centered
            x={windows[2][0] * w - 260 * k}
            y={windows[2][1] * h - 70 * k}
            style={{ transform: `translate(-50%, -50%) scale(${tomato})` }}
          >
            <Tomato scale={Math.round(7 * k)} />
          </Centered>
          <Timer
            progress={timer}
            style={{
              left: windows[2][0] * w - 330 * k,
              top: windows[2][1] * h - 330 * k,
              transform: `scale(${tomato * k})`
            }}
          />
        </>
      ) : (
        <Centered x={catX} y={catY}>
          <Noodle mood="working" scale={cat} walking facing={x1 < x0 ? 'left' : 'right'} />
        </Centered>
      )}
      <Headline
        text={curled ? T.focus : T.buddy}
        key={curled ? 'focus' : 'buddy'}
        delay={curled ? hopEnd : beats(0.5)}
        size={head}
        style={{ left: 0, right: 0, justifyContent: 'center', top: vertical ? h * 0.12 : h * 0.08 }}
      />
    </AbsoluteFill>
  )
}

// ---------- 3. Music: notes pop out of the timer, headphones fly on, he bobs ----------

export function Music() {
  const f = useCurrentFrame()
  const { w, h, vertical } = useLayout()
  const { head, cat, k } = useSizes()
  const phones = useSpring(beats(2), 12)
  const bubble = useSpring(beats(4), 14)
  const wear: Wearable[] = phones > 0.95 ? ['headphones'] : []
  const notes = Array.from({ length: 9 }, (_, i) => {
    const t = (f - i * 6) / 60
    return {
      x: w / 2 + Math.sin(i * 1.7) * w * 0.25 * Math.min(1, t),
      y: h * 0.62 - t * h * 0.35,
      o: interpolate(t, [0, 0.2, 1.4], [0, 1, 0], clamp),
      ch: ['♪', '♫', '♬'][i % 3]
    }
  })
  return (
    <AbsoluteFill>
      <Backdrop tint={C.lilac} />
      {notes.map((n, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: n.x,
            top: n.y,
            fontSize: 70 * k,
            color: [C.purple, C.blue, C.red][i % 3],
            opacity: n.o,
            fontFamily: FONT,
            fontWeight: 900
          }}
        >
          {n.ch}
        </div>
      ))}
      <Centered
        x={w / 2}
        y={h * (vertical ? 0.55 : 0.6)}
        style={{
          transform: `translate(-50%, -50%) translateY(${
            phones > 0.95 ? Math.abs(Math.sin((f / beats(1)) * Math.PI)) * -14 * k : 0
          }px)`
        }}
      >
        <Noodle mood="sleeping" vibe={phones > 0.95 ? 'groove' : undefined} wear={wear} scale={cat} />
      </Centered>
      {phones < 0.95 && (
        <Centered x={w / 2 + 40 * k} y={interpolate(phones, [0, 1], [-200, h * 0.5])}>
          <div style={{ fontSize: 120 * k }}>🎧</div>
        </Centered>
      )}
      <MusicBubble
        style={{
          left: vertical ? w * 0.12 : w * 0.62,
          top: vertical ? h * 0.72 : h * 0.3,
          transform: `translateX(${(1 - bubble) * 400}px) scale(${k})`,
          transformOrigin: 'left top',
          opacity: bubble
        }}
      />
      <Headline
        text={T.music}
        delay={beats(3)}
        size={head}
        style={{ left: 0, right: 0, justifyContent: 'center', top: vertical ? h * 0.15 : h * 0.1 }}
      />
    </AbsoluteFill>
  )
}

// ---------- 4. Dev: terminal, coffee mug tail, needs you, Approve, rainbow, phone ----------

export function Dev() {
  const f = useCurrentFrame()
  const { w, h, vertical } = useLayout()
  const { head, cat, k } = useSizes()
  const term = useSpring(0, 15)
  const needsAt = sec(3)
  const approveAt = sec(5.6)
  const happyAt = sec(6.2)
  const phoneAt = sec(7.8)
  const mood = f < needsAt ? 'working' : f < happyAt ? 'needs' : 'happy'
  const bubble = useSpring(needsAt + beats(1), 13)
  const pressed = interpolate(f, [approveAt, approveAt + 8, approveAt + 20], [0, 1, 0], clamp)
  const phone = useSpring(phoneAt, 14)
  const hop = f >= needsAt && f < happyAt ? Math.abs(Math.sin((f - needsAt) / 9)) * 30 * k : 0
  const text = f < needsAt ? T.working : f < happyAt ? T.needs : T.approval
  const catX = vertical ? w / 2 : w * 0.62
  const catY = vertical ? h * 0.62 : h * 0.62
  return (
    <AbsoluteFill>
      <Backdrop tint={C.sky} />
      <Terminal
        lines={['> fix the login bug', '● Reading auth.ts', '● Editing session.ts', '● Running npm test…']}
        style={{
          left: vertical ? w * 0.08 : w * 0.06,
          top: vertical ? h * 0.24 : h * 0.3,
          transform: `translateY(${(1 - term) * 300}px) scale(${k})`,
          transformOrigin: 'left top',
          opacity: term
        }}
      />
      <Centered x={catX} y={catY - hop}>
        <Noodle mood={mood} scale={cat} />
      </Centered>
      {f >= needsAt && f < happyAt + sec(1) && (
        <ApproveBubble
          pressed={pressed}
          style={{
            left: catX - 200 * k,
            top: catY - 420 * k,
            transform: `scale(${bubble * k})`,
            transformOrigin: 'left bottom'
          }}
        />
      )}
      {/* the cursor taps Approve */}
      {f > approveAt - sec(0.8) && f < happyAt + sec(0.6) && (
        <Centered
          x={interpolate(f, [approveAt - sec(0.8), approveAt], [w * 0.95, catX - 120 * k], clamp)}
          y={interpolate(f, [approveAt - sec(0.8), approveAt], [h * 0.95, catY - 250 * k], clamp)}
        >
          <svg width={48 * k} height={60 * k} viewBox="0 0 24 30">
            <path d="M2 2 L2 24 L8 18 L12 28 L16 26 L12 17 L20 17 Z" fill={C.white} stroke={C.ink} strokeWidth={2} />
          </svg>
        </Centered>
      )}
      <Confetti at={happyAt} x={catX} y={catY - 120 * k} />
      <Phone
        style={{
          left: vertical ? w * 0.62 : w * 0.82,
          top: vertical ? h * 0.08 : h * 0.18,
          transform: `translateX(${(1 - phone) * 500}px) rotate(${
            f > phoneAt + 20 ? Math.sin(f * 1.3) * 4 * Math.max(0, 1 - (f - phoneAt - 20) / 60) : 0
          }deg) scale(${k * 0.9})`,
          transformOrigin: 'left top',
          opacity: phone
        }}
      />
      <Headline
        key={text}
        text={text}
        delay={text === T.working ? beats(1) : text === T.needs ? needsAt : happyAt}
        size={head * 0.9}
        style={{
          left: vertical ? 0 : w * 0.06,
          right: vertical ? 0 : undefined,
          justifyContent: vertical ? 'center' : undefined,
          top: vertical ? h * 0.1 : h * 0.1
        }}
      />
    </AbsoluteFill>
  )
}

/** Rainbow confetti: rounded shapes bursting out, falling with gravity. */
function Confetti({ at, x, y }: { at: number; x: number; y: number }) {
  const f = useCurrentFrame()
  const t = (f - at) / 60
  if (t < 0 || t > 2.5) return null
  const colors = [C.red, C.orange, C.yellow, C.green, C.blue, C.purple]
  return (
    <>
      {Array.from({ length: 48 }, (_, i) => {
        const angle = (i / 48) * Math.PI * 2 + (i % 3) * 0.2
        const speed = 500 + (i % 7) * 90
        const px = x + Math.cos(angle) * speed * t
        const py = y + Math.sin(angle) * speed * t + 700 * t * t
        const size = 14 + (i % 4) * 6
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              width: size,
              height: i % 2 ? size : size * 0.5,
              borderRadius: i % 3 === 0 ? '50%' : 4,
              background: colors[i % colors.length],
              transform: `rotate(${t * 400 + i * 30}deg)`,
              opacity: interpolate(t, [0, 2, 2.5], [1, 1, 0], clamp)
            }}
          />
        )
      })}
    </>
  )
}

// ---------- 5. Night: kitten → cat → top hat, recap card flips in ----------

export function Night() {
  const f = useCurrentFrame()
  const { w, h, vertical } = useLayout()
  const { head, cat, k } = useSizes()
  const night = interpolate(f, [0, sec(1.2)], [0, 1], clamp)
  const stage = f < sec(2) ? 0 : f < sec(3.5) ? 1 : 2
  const pop = useSpring(stage === 0 ? 0 : stage === 1 ? sec(2) : sec(3.5), 8)
  const card = useSpring(sec(4.8), 14)
  const scale = stage === 0 ? cat - 2 : cat
  const wear: Wearable[] = stage === 2 ? ['tophat'] : []
  return (
    <AbsoluteFill>
      <Backdrop night={night} />
      <Centered
        x={vertical ? w / 2 : w * 0.33}
        y={vertical ? h * 0.42 : h * 0.58}
        style={{ transform: `translate(-50%, -50%) scale(${0.85 + 0.15 * pop})` }}
      >
        <Noodle mood={stage === 2 ? 'happy' : 'working'} scale={scale} wear={wear} chonky={false} />
      </Centered>
      <Centered
        x={vertical ? w / 2 : w * 0.33}
        y={vertical ? h * 0.27 : h * 0.3}
        style={{ opacity: f > sec(1.5) ? 1 : 0 }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontWeight: 800,
            fontSize: 40 * k,
            color: C.yellow,
            transform: `scale(${pop})`
          }}
        >
          {['Level 3 · kitten', 'Level 7 · cat', 'Level 12 · 🎩 unlocked'][stage]}
        </div>
      </Centered>
      <RecapCard
        style={{
          left: vertical ? w * 0.14 : w * 0.58,
          top: vertical ? h * 0.58 : h * 0.26,
          transform: `perspective(1400px) rotateY(${(1 - card) * 90}deg) scale(${k})`,
          transformOrigin: 'left top',
          opacity: card
        }}
      />
      <Headline
        text={T.grows}
        delay={sec(1)}
        size={head}
        color={C.white}
        style={{ left: 0, right: 0, justifyContent: 'center', top: vertical ? h * 0.08 : h * 0.08 }}
      />
    </AbsoluteFill>
  )
}

// ---------- 6. Pick your cat ----------

export function Cats() {
  const f = useCurrentFrame()
  const { w, h, vertical } = useLayout()
  const { head, cat } = useSizes()
  const skins = ['noodle', 'mochi', 'zitouna'] as const
  return (
    <AbsoluteFill>
      <Backdrop tint={C.butter} />
      {skins.map((skin, i) => {
        const s = useSpring(beats(1 + i), 9)
        const x = vertical ? w / 2 : w * (0.22 + i * 0.28)
        const y = vertical ? h * (0.34 + i * 0.2) : h * 0.6
        const wave = Math.sin((f / beats(1)) * Math.PI + i) * 6
        return (
          <Centered
            key={skin}
            x={x}
            y={y}
            style={{ transform: `translate(-50%, -50%) scale(${s}) rotate(${wave * s}deg)` }}
          >
            <Noodle mood="happy" skin={skin} scale={vertical ? cat - 1 : cat - 2} />
            <div
              style={{
                textAlign: 'center',
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 40,
                color: C.ink,
                marginTop: 4
              }}
            >
              {['Noodle', 'Mochi', 'Zitouna'][i]}
            </div>
          </Centered>
        )
      })}
      <Headline
        text={T.pick}
        delay={beats(4)}
        size={head}
        style={{ left: 0, right: 0, justifyContent: 'center', top: vertical ? h * 0.08 : h * 0.1 }}
      />
    </AbsoluteFill>
  )
}

// ---------- 7. Logo ----------

export function Logo() {
  const { w, h } = useLayout()
  const { head, cat, k } = useSizes()
  const icon = useSpring(0, 11)
  const name = useSpring(beats(1.5), 12)
  const line = useSpring(beats(3), 14)
  return (
    <AbsoluteFill>
      <Backdrop tint={C.peach} />
      <Centered x={w / 2} y={h * 0.4}>
        <div
          style={{
            width: 360 * k,
            height: 360 * k,
            borderRadius: 80 * k,
            background: C.white,
            boxShadow: '0 30px 70px rgba(31,28,26,0.18)',
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            transform: `scale(${icon})`
          }}
        >
          <NoodleHead scale={Math.round(8 * k)} />
        </div>
      </Centered>
      <Centered x={w / 2} y={h * 0.66} style={{ opacity: name }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: head * 1.1, color: C.ink }}>
          {CONFIG.name}.
        </div>
      </Centered>
      <Centered x={w / 2} y={h * 0.77} style={{ opacity: line, textAlign: 'center' }}>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 40 * k, color: C.inkSoft }}>
          {CONFIG.platforms}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 32 * k, color: C.purple, marginTop: 10 }}>
          {CONFIG.url}
        </div>
      </Centered>
    </AbsoluteFill>
  )
}
