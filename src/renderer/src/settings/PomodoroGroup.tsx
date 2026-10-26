// Settings › Features › Pomodoro: start / stop, and the lengths of focus and breaks.
import type { PetSettings } from '@shared/ipc'
import { phaseLabel, timeLeft } from '@shared/pomodoro'
import type { PomodoroSettings } from '@shared/settings'
import { useEffect, useState } from 'react'
import { usePomodoro } from '../usePomodoro'
import { Group, Row } from './controls'

const FIELDS: Array<[keyof PomodoroSettings, string, string]> = [
  ['focusMin', 'Focus', 'min'],
  ['breakMin', 'Break', 'min'],
  ['longBreakMin', 'Long break', 'min'],
  ['rounds', 'Long break after', 'rounds']
]

export function PomodoroGroup({ settings }: { settings: PetSettings }): React.JSX.Element {
  const state = usePomodoro()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const running = state?.phase != null
  return (
    <Group title="🍅 Pomodoro">
      <Row
        label={running && state ? `${phaseLabel(state)} · ${timeLeft(state, now)} left` : 'Timer'}
        description={`Focus rounds earn a fish and XP. ${state?.today ?? 0} done today.`}
      >
        {running ? (
          <>
            <button
              className="btn btn-terminal"
              onClick={() => window.api.pomodoro(state?.pausedLeftMs != null ? 'resume' : 'pause')}
            >
              {state?.pausedLeftMs != null ? 'Resume' : 'Pause'}
            </button>
            <button className="btn btn-terminal" onClick={() => window.api.pomodoro('skip')}>
              Skip
            </button>
            <button className="btn btn-deny" onClick={() => window.api.pomodoro('stop')}>
              Stop
            </button>
          </>
        ) : (
          <button className="btn btn-approve" onClick={() => window.api.pomodoro('start')}>
            Start 🍅
          </button>
        )}
      </Row>
      <div className="settings-numbers">
        {FIELDS.map(([key, label, unit]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              min={1}
              max={120}
              value={settings.pomodoro[key]}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (n > 0) window.api.changeSettings({ pomodoro: { [key]: n } })
              }}
            />
            <span className="connect-small">{unit}</span>
          </label>
        ))}
      </div>
    </Group>
  )
}
