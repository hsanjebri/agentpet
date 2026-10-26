// Hover bubble during a Pomodoro: phase, time left, and pixel pause / skip / stop buttons.
import { type PomodoroCommand, type PomodoroState, phaseLabel, timeLeft } from '@shared/pomodoro'
import { useEffect, useState } from 'react'
import { PixelIcon } from './MusicBubble'

// 1 character = 1 pixel (k = ink)
const ICONS = {
  play: ['k.....', 'kkk...', 'kkkkk.', 'kkkkkk', 'kkkkk.', 'kkk...', 'k.....'],
  pause: ['kk..kk', 'kk..kk', 'kk..kk', 'kk..kk', 'kk..kk', 'kk..kk', 'kk..kk'],
  skip: ['k...k.', 'kk..kk', 'kkk.kk', 'kkkkkk', 'kkk.kk', 'kk..kk', 'k...k.'],
  stop: ['kkkkkk', 'kkkkkk', 'kkkkkk', 'kkkkkk', 'kkkkkk', 'kkkkkk', '......']
} as const

export function PomodoroBubble({ state }: { state: PomodoroState }): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const paused = state.pausedLeftMs !== null
  const button = (
    cmd: PomodoroCommand,
    icon: readonly string[],
    label: string
  ): React.JSX.Element => (
    <button
      className="btn btn-icon"
      data-ui=""
      title={label}
      aria-label={label}
      onClick={() => window.api.pomodoro(cmd)}
    >
      <PixelIcon rows={icon} />
    </button>
  )

  return (
    <div className="bubble bubble-music" data-ui="">
      <div>
        {phaseLabel(state)} · <b>{timeLeft(state, now)}</b> left{paused ? ' (paused)' : ''}
      </div>
      <div className="bubble-sub">{state.today} done today</div>
      <div className="bubble-actions">
        {paused ? button('resume', ICONS.play, 'Resume') : button('pause', ICONS.pause, 'Pause')}
        {button('skip', ICONS.skip, 'Skip')}
        {button('stop', ICONS.stop, 'Stop')}
      </div>
    </div>
  )
}
