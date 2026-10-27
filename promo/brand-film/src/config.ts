// Everything you'd want to tweak in one place: text, colors, URL, BPM, scene timings, audio.

export const CONFIG = {
  fps: 60,
  /** the beat grid every pop and cut lands on */
  bpm: 120,
  url: 'hsanjebri.github.io/agentpet',
  name: 'Noodle',
  platforms: 'Free for Windows · Mac · Linux',

  colors: {
    cream: '#FFF6E9',
    peach: '#FFD9C2',
    mint: '#CFF3E1',
    sky: '#D6E8FF',
    lilac: '#E6DCFF',
    butter: '#FFF0B8',
    ink: '#1F1C1A',
    inkSoft: '#4A4642',
    white: '#FFFFFF',
    red: '#E24B4A',
    yellow: '#F6C744',
    green: '#5CC46B',
    blue: '#4A9FE0',
    purple: '#8B6FD8',
    orange: '#F28C28',
    pink: '#F4A0AE',
    night: '#252B4A',
    nightDeep: '#141832'
  },

  /** seconds; scenes overlap a little where they morph into each other */
  scenes: {
    morning: { from: 0, to: 4 },
    focus: { from: 4, to: 10 },
    music: { from: 10, to: 16 },
    dev: { from: 16, to: 26 },
    night: { from: 26, to: 34 },
    cats: { from: 34, to: 40 },
    logo: { from: 40, to: 45 }
  },

  text: {
    morning: 'Meet Noodle.',
    buddy: 'Your new desk buddy.',
    focus: 'Focus, together.',
    music: 'Vibes to your music.',
    working: 'Your AI is working.',
    needs: 'It needs you.',
    approval: 'Never miss an approval.',
    grows: 'Grows with you.',
    pick: 'Pick your cat.',
    recap: ['4 focus sessions', '12 songs', '31 tasks'],
    song: { title: 'lofi beats to code to', artist: 'Chillhop' },
    phone: { app: 'Noodle', title: 'Claude needs you', body: 'my-app wants to run npm test' },
    command: 'npm test'
  },

  /**
   * Put files in public/audio/ and name them here (null = silent). Music: upbeat, royalty-free,
   * ~120 BPM so it lands on the beat grid.
   */
  audio: {
    music: null as string | null,
    musicVolume: 0.8,
    sfx: {
      meow: null as string | null,
      purr: null as string | null,
      pop: null as string | null,
      whoosh: null as string | null,
      toot: null as string | null,
      buzz: null as string | null,
      levelUp: null as string | null
    }
  }
}

export const FPS = CONFIG.fps
export const sec = (s: number): number => Math.round(s * FPS)
/** frames per beat at CONFIG.bpm */
export const BEAT = (60 / CONFIG.bpm) * FPS
export const beats = (n: number): number => Math.round(n * BEAT)

export type SceneId = keyof typeof CONFIG.scenes
export const sceneFrames = (id: SceneId): { from: number; duration: number } => {
  const s = CONFIG.scenes[id]
  return { from: sec(s.from), duration: sec(s.to - s.from) }
}

export const TOTAL = sec(45)
