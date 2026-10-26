// Tiny synthesized sounds (Web Audio), so there are no audio files to ship or license.
//   meow: the agent needs you (soft: a Pomodoro break)
//   toot: task done (the rainbow fart)
//   purr: while being petted
//   tick: softly, once a second during a Pomodoro focus round (off by default)
// Everything goes through one master volume (Settings › Features › Sounds).

let context: AudioContext | null = null
let master: GainNode | null = null
let volume = 0.8

function audio(): AudioContext {
  context ??= new AudioContext()
  return context
}

/** Where every sound plays into. */
function out(): GainNode {
  if (!master) {
    master = audio().createGain()
    master.gain.value = volume
    master.connect(audio().destination)
  }
  return master
}

/** 0–1. */
export function setVolume(value: number): void {
  volume = value
  if (master) master.gain.value = value
}

/** A short "mi-aow": a voice-like buzz whose pitch rises then falls, through a vowel filter. */
export function playMeow(loudness = 1): void {
  const ac = audio()
  const t = ac.currentTime
  const voice = ac.createOscillator()
  voice.type = 'sawtooth'
  voice.frequency.setValueAtTime(520, t)
  voice.frequency.linearRampToValueAtTime(880, t + 0.12)
  voice.frequency.exponentialRampToValueAtTime(430, t + 0.5)

  // "ee" -> "ow": move the formant down while the pitch falls
  const vowel = ac.createBiquadFilter()
  vowel.type = 'bandpass'
  vowel.Q.value = 3
  vowel.frequency.setValueAtTime(2200, t)
  vowel.frequency.exponentialRampToValueAtTime(900, t + 0.45)

  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.35 * loudness, t + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)

  voice.connect(vowel).connect(gain).connect(out())
  voice.start(t)
  voice.stop(t + 0.6)
}

/** A short, silly "prrt" for the rainbow: low wobbly buzz that drops in pitch. */
export function playToot(): void {
  const ac = audio()
  const t = ac.currentTime
  const buzz = ac.createOscillator()
  buzz.type = 'square'
  buzz.frequency.setValueAtTime(140, t)
  buzz.frequency.exponentialRampToValueAtTime(70, t + 0.35)

  const wobble = ac.createOscillator()
  wobble.frequency.value = 28
  const wobbleDepth = ac.createGain()
  wobbleDepth.gain.value = 25
  wobble.connect(wobbleDepth).connect(buzz.frequency)

  const muffle = ac.createBiquadFilter()
  muffle.type = 'lowpass'
  muffle.frequency.value = 700

  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)

  buzz.connect(muffle).connect(gain).connect(out())
  buzz.start(t)
  wobble.start(t)
  buzz.stop(t + 0.45)
  wobble.stop(t + 0.45)
}

let purr: { stop(): void } | null = null

/** A soft, rumbly purr that keeps going until stopPurr(). */
export function startPurr(): void {
  if (purr) return
  const ac = audio()
  const t = ac.currentTime
  const rumble = ac.createOscillator()
  rumble.type = 'sawtooth'
  rumble.frequency.value = 42

  // the purr's "brrr": volume pulsing ~24 times a second
  const flutter = ac.createOscillator()
  flutter.frequency.value = 24
  const flutterDepth = ac.createGain()
  flutterDepth.gain.value = 0.08

  const soft = ac.createBiquadFilter()
  soft.type = 'lowpass'
  soft.frequency.value = 260

  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(0.12, t + 0.3)
  flutter.connect(flutterDepth).connect(gain.gain)

  rumble.connect(soft).connect(gain).connect(out())
  rumble.start(t)
  flutter.start(t)
  purr = {
    stop: () => {
      const end = ac.currentTime
      gain.gain.cancelScheduledValues(end)
      gain.gain.setValueAtTime(gain.gain.value, end)
      gain.gain.linearRampToValueAtTime(0.0001, end + 0.25)
      rumble.stop(end + 0.3)
      flutter.stop(end + 0.3)
    }
  }
}

export function stopPurr(): void {
  purr?.stop()
  purr = null
}

/** A tiny wooden "tk", like a kitchen timer. */
export function playTick(): void {
  const ac = audio()
  const t = ac.currentTime
  const click = ac.createOscillator()
  click.type = 'triangle'
  click.frequency.setValueAtTime(1800, t)
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.06, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
  click.connect(gain).connect(out())
  click.start(t)
  click.stop(t + 0.04)
}
