// The full film and the 15 s cut: scenes in sequence, plus the music and sound-effect cues.
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { CONFIG, type SceneId, beats, sceneFrames, sec } from './config'
import { Cats, Dev, Focus, Logo, Morning, Music, Night } from './scenes/scenes'

const SCENES: Record<SceneId, () => React.JSX.Element> = {
  morning: Morning,
  focus: Focus,
  music: Music,
  dev: Dev,
  night: Night,
  cats: Cats,
  logo: Logo
}

/** Scales and fades each scene in, so they flow into each other (morphs come later). */
function SceneIn({ children, duration }: { children: React.ReactNode; duration: number }) {
  const f = useCurrentFrame()
  const inP = interpolate(f, [0, beats(0.5)], [0, 1], { extrapolateRight: 'clamp' })
  const out = interpolate(f, [duration - beats(0.5), duration], [1, 0], { extrapolateLeft: 'clamp' })
  return (
    <AbsoluteFill
      style={{ opacity: Math.min(inP, out), transform: `scale(${0.96 + 0.04 * Math.min(inP, out)})` }}
    >
      {children}
    </AbsoluteFill>
  )
}

/** Sound effects, in seconds of the full film. Files are set in config.ts (null = silent). */
const SFX: Array<[keyof typeof CONFIG.audio.sfx, number]> = [
  ['whoosh', 0.2],
  ['pop', 1.0],
  ['meow', 2.6],
  ['purr', 6.6],
  ['pop', 10.4],
  ['whoosh', 16.0],
  ['meow', 19.0],
  ['pop', 21.6],
  ['toot', 22.2],
  ['buzz', 24.0],
  ['levelUp', 28.0],
  ['levelUp', 29.5],
  ['pop', 34.6],
  ['whoosh', 40.0],
  ['meow', 43.0]
]

function Sounds({ cues }: { cues: Array<[keyof typeof CONFIG.audio.sfx, number]> }) {
  return (
    <>
      {CONFIG.audio.music && (
        <Audio src={staticFile(`audio/${CONFIG.audio.music}`)} volume={CONFIG.audio.musicVolume} />
      )}
      {cues.map(([name, at], i) => {
        const file = CONFIG.audio.sfx[name]
        return file ? (
          <Sequence key={i} from={sec(at)}>
            <Audio src={staticFile(`audio/${file}`)} />
          </Sequence>
        ) : null
      })}
    </>
  )
}

export function Film() {
  return (
    <AbsoluteFill style={{ background: CONFIG.colors.cream }}>
      {(Object.keys(SCENES) as SceneId[]).map((id) => {
        const { from, duration } = sceneFrames(id)
        const Scene = SCENES[id]
        return (
          <Sequence key={id} from={from} durationInFrames={duration} name={id}>
            <SceneIn duration={duration}>
              <Scene />
            </SceneIn>
          </Sequence>
        )
      })}
      <Sounds cues={SFX} />
    </AbsoluteFill>
  )
}

/** 15 s: morning (3 s), the dev moment from "it needs you" (7 s), logo (5 s). */
export function Cut15() {
  return (
    <AbsoluteFill style={{ background: CONFIG.colors.cream }}>
      <Sequence from={0} durationInFrames={sec(3)}>
        <SceneIn duration={sec(3)}>
          <Morning />
        </SceneIn>
      </Sequence>
      <Sequence from={sec(3)} durationInFrames={sec(7)}>
        <SceneIn duration={sec(7)}>
          <Sequence from={-sec(2.5)}>
            <Dev />
          </Sequence>
        </SceneIn>
      </Sequence>
      <Sequence from={sec(10)} durationInFrames={sec(5)}>
        <SceneIn duration={sec(5)}>
          <Logo />
        </SceneIn>
      </Sequence>
      <Sounds
        cues={[
          ['whoosh', 0.2],
          ['meow', 2.0],
          ['meow', 4.0],
          ['toot', 6.9],
          ['buzz', 8.3],
          ['whoosh', 10.0],
          ['meow', 13.0]
        ]}
      />
    </AbsoluteFill>
  )
}
