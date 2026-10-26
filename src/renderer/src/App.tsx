import type { PetSettings } from '@shared/ipc'
import { leftMs } from '@shared/pomodoro'
import { timeMood } from '@shared/progress'
import type { SoundName } from '@shared/settings'
import { useEffect, useRef, useState } from 'react'
import { ApprovalBubble } from './ApprovalBubble'
import { demoUsage, useDemo } from './demo'
import { InfoBubble } from './InfoBubble'
import type { Mood } from './moods'
import { MusicBubble } from './MusicBubble'
import { Pet } from './pets/Pet'
import { Tomato } from './pets/Tomato'
import { PomodoroBubble } from './PomodoroBubble'
import { sessionLine } from './sessionLine'
import { playMeow, playTick, playToot, setVolume, startPurr, stopPurr } from './sounds'
import { useAgentBridge, useMood, usePetStore } from './store'
import { UsageBar } from './UsageBar'
import { usePetPointer } from './usePetPointer'
import { usePomodoro } from './usePomodoro'
import { useSettings } from './useSettings'

const FOCUS_MOODS: ReadonlySet<Mood> = new Set(['needs', 'hiss', 'sad'])
const TOAST_MS = 4000
/** keeps the hover bubble open while the pointer crosses the gap to its buttons */
const HOVER_GRACE_MS = 500
const STRETCH_MS = 1400

/** Whether this sound may play now (Mute, and each sound's own switch). */
function soundOn(settings: PetSettings, name: SoundName): boolean {
  return !settings.muted && settings.sounds[name]
}

/** Meow when the agent starts needing you, toot when a task is done (if those sounds are on). */
function useMoodSounds(mood: Mood, settings: PetSettings, double: boolean): void {
  const previous = useRef(mood)
  const meow = soundOn(settings, 'meow')
  const toot = soundOn(settings, 'toot')
  useEffect(() => {
    if (mood !== previous.current) {
      if (mood === 'needs' && meow) playMeow()
      if (mood === 'happy' && toot) {
        playToot()
        if (double) setTimeout(playToot, 380)
      }
    }
    previous.current = mood
  }, [mood, meow, toot, double])
}

/** "go to bed 😴" when the agent works late at night, "good morning ☕" once a day. */
function useTimeGreetings(mood: Mood, name: string, enabled: boolean): void {
  const greeted = useRef<{ morning?: string; lateNight?: number }>({})
  useEffect(() => {
    if (!enabled || mood !== 'working') return
    const now = Date.now()
    const { greeting } = timeMood(now)
    const { showToast } = usePetStore.getState()
    const today = new Date(now).toDateString()
    if (greeting === 'morning' && greeted.current.morning !== today) {
      greeted.current.morning = today
      showToast(`good morning ☕ ${name} is up`)
    }
    if (greeting === 'late_night' && now - (greeted.current.lateNight ?? 0) > 60 * 60_000) {
      greeted.current.lateNight = now
      showToast('it’s late… go to bed 😴')
    }
  }, [mood, name, enabled])
}

/** A counter that bumps to replay a one-shot animation, and resets once it has played. */
function useOneShot(durationMs: number): [number, () => void] {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!count) return
    const timer = setTimeout(() => setCount(0), durationMs)
    return () => clearTimeout(timer)
  }, [count, durationMs])
  return [count, () => setCount((c) => c + 1)]
}

/** The time, updated every second while `active` (for timers drawn on the pet). */
function useNow(active: boolean): number {
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (!active) return
    const update = (): void => setNow(Date.now())
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

/** Calls `run` whenever `value` changes after the first render. */
function useOnChange(value: number, run: () => void): void {
  const seen = useRef(value)
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  })
  useEffect(() => {
    if (value === seen.current) return
    seen.current = value
    runRef.current()
  }, [value])
}

function App(): React.JSX.Element {
  const settings = useSettings()
  const { skin, size, demo, focusMode, music: musicOn } = settings
  const { step: demoStep, next: nextDemoStep } = useDemo(demo)
  useAgentBridge()
  const pomodoro = usePomodoro()
  const liveMood = useMood()
  const liveUsage = usePetStore((s) => s.usage)
  const prompts = usePetStore((s) => s.prompts)
  const session = usePetStore((s) => s.session)
  const warning = usePetStore((s) => s.warning)
  const look = usePetStore((s) => s.look)
  const walk = usePetStore((s) => s.walk)
  const rare = usePetStore((s) => s.rare)
  const toast = usePetStore((s) => s.toast)
  const music = usePetStore((s) => s.music)
  const headphones = usePetStore((s) => s.headphones)
  const grooving = usePetStore((s) => s.grooving)
  const musicResumed = usePetStore((s) => s.musicResumed)
  const hello = usePetStore((s) => s.hello)
  const breakStarted = usePetStore((s) => s.breakStarted)
  const dispatch = usePetStore((s) => s.dispatch)
  const [hoveredAt, setHoveredAt] = useState<number | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [petting, setPetting] = useState(false)
  const [partyHat] = useState(() => timeMood(Date.now()).partyHat)
  const [flick, playFlick] = useOneShot(260)
  const [wiggle, playWiggle] = useOneShot(620)
  const [stretch, playStretch] = useOneShot(STRETCH_MS)
  const purrOn = soundOn(settings, 'purr')

  useEffect(() => setVolume(settings.sounds.volume), [settings.sounds.volume])

  usePetPointer({
    onClick: () => {
      dispatch({ type: 'pet_clicked' })
      window.api.petClicked()
    },
    onHover: (hovering) => {
      clearTimeout(hoverTimer.current)
      if (hovering) setHoveredAt((at) => at ?? Date.now())
      else hoverTimer.current = setTimeout(() => setHoveredAt(null), HOVER_GRACE_MS)
    },
    onPet: (on) => {
      setPetting(on)
      if (on) window.api.petted()
      if (on && purrOn) startPurr()
      else stopPurr()
    },
    onMenu: () => window.api.petMenu()
  })

  // any change in Settings: a small happy wiggle, so you see it landed
  const wiggleRef = useRef(playWiggle)
  useEffect(() => {
    wiggleRef.current = playWiggle
  })
  useEffect(() => window.api.onSettings(() => wiggleRef.current()), [])

  // music resumed: a quick happy wiggle
  useOnChange(musicResumed, playWiggle)

  // setup finished: a wiggle and a meow to say hi
  useOnChange(hello, () => {
    playWiggle()
    if (soundOn(settings, 'meow')) playMeow()
  })

  // a Pomodoro break: he wakes up, stretches and meows softly
  useOnChange(breakStarted, () => {
    playStretch()
    if (soundOn(settings, 'meow')) playMeow(0.4)
  })

  // Pomodoro focus round: curled up on the tomato, quiet. Approvals still get through.
  const focusRound = !demoStep && pomodoro?.phase === 'focus'
  const focusRunning = focusRound && pomodoro?.pausedLeftMs === null
  const now = useNow(focusRound)
  const tickOn = soundOn(settings, 'tick')
  useEffect(() => {
    if (!focusRunning || !tickOn) return
    const timer = setInterval(playTick, 1000)
    return () => clearInterval(timer)
  }, [focusRunning, tickOn])

  const agentMood = demoStep?.mood ?? liveMood
  // during focus only "needs you" breaks the calm; the rest waits for the break
  const mood: Mood = focusRound && agentMood !== 'needs' ? 'sleeping' : agentMood
  const usage = demoStep ? demoUsage(demoStep) : liveUsage
  const prompt = demoStep ? demoStep.prompt : prompts[0]
  const walking = !demoStep && !focusRound && walk.walking

  // Music sits below every agent mood and above wandering / sleeping:
  // idle + music = vibing; working + music = working with headphones on.
  // During a focus round the vibing is calmer (no grooving).
  const listening = !demoStep && musicOn && headphones
  const vibe =
    listening && mood === 'sleeping' ? (grooving && !focusRound ? 'groove' : 'still') : undefined

  useMoodSounds(mood, settings, rare === 'double')
  useTimeGreetings(liveMood, look?.petName ?? 'Noodle', settings.greetings && !focusRound)

  // celebration bubbles fade away by themselves
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => usePetStore.setState({ toast: null }), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  // needs you (for real, not in the demo): hop toward the middle of the screen until answered
  const alert = !demoStep && mood === 'needs'
  useEffect(() => window.api.setAlert(alert), [alert])

  // focus mode: stay out of sight unless something needs attention (or he's vibing, or a
  // Pomodoro is on: then he's curled up on the tomato)
  const pomodoroOn = !demoStep && pomodoro?.phase != null
  if (
    focusMode &&
    !demoStep &&
    !prompt &&
    !FOCUS_MOODS.has(mood) &&
    !vibe &&
    !pomodoroOn &&
    !toast
  ) {
    return <main className="stage" />
  }

  const showMusicBubble = musicOn && !demoStep && (music.hasSession || headphones)
  const hovered = hoveredAt !== null && !demoStep
  let bubble: React.JSX.Element | null = null
  if (prompt) {
    bubble = (
      <ApprovalBubble
        prompt={prompt}
        more={demoStep ? 0 : prompts.length - 1}
        onDecide={(decision) =>
          demoStep ? nextDemoStep() : window.api.decide(prompt.id, decision)
        }
      />
    )
  } else if (!demoStep && mood === 'hiss' && warning) {
    bubble = <div className="bubble bubble-warning">⚠ {warning}</div>
  } else if (hovered && pomodoroOn && pomodoro) {
    bubble = <PomodoroBubble state={pomodoro} />
  } else if (hovered && showMusicBubble) {
    // focus mode: music animation only, no song bubbles
    if (!focusMode) {
      bubble = (
        <MusicBubble
          music={music}
          agentLine={session ? sessionLine(session, hoveredAt) : undefined}
          onCommand={(command) => {
            window.api.musicCommand(command)
            playFlick()
          }}
        />
      )
    }
  } else if (toast && !demoStep && !(toast.music && focusMode)) {
    bubble = (
      <div key={toast.id} className="bubble bubble-info">
        {toast.text}
      </div>
    )
  } else if (hovered) {
    bubble = <InfoBubble session={session} look={look} now={hoveredAt} />
  }

  const focusLength = (settings.pomodoro.focusMin || 25) * 60_000
  const showUsage = usage && (demoStep || (settings.usageBar && settings.mode === 'developer'))

  return (
    <main className="stage">
      {demoStep && <div className="demo-label">{demoStep.label}</div>}
      {bubble}
      <div className={`pet-spot${stretch ? ' stretching' : ''}`}>
        {focusRound && pomodoro && (
          <div className="pomodoro-tomato" aria-hidden>
            <Tomato
              progress={now ? 1 - leftMs(pomodoro, now) / focusLength : 0}
              scale={size === 's' ? 2 : 3}
            />
          </div>
        )}
        <Pet
          skin={skin}
          size={size}
          mood={walking ? 'working' : mood}
          look={look}
          partyHat={partyHat}
          headphones={listening}
          walking={walking && !vibe}
          facing={walk.facing}
          rare={demoStep ? null : rare}
          vibe={vibe}
          flick={flick}
          wiggle={wiggle}
        />
        {petting && (
          <div className="hearts" aria-hidden>
            <span>❤</span>
            <span>❤</span>
            <span>❤</span>
          </div>
        )}
      </div>
      {showUsage && usage && <UsageBar usage={usage} />}
    </main>
  )
}

export default App
