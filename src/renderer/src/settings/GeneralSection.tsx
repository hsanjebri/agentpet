// Settings › General: mode, start on login, updates, position, onboarding.
import type { AppInfo, ConnectStatus, PetSettings } from '@shared/ipc'
import type { UserMode } from '@shared/settings'
import { useEffect, useState } from 'react'
import { ActionButton, Choice, Group, Row, Section, Toggle } from './controls'

/** Switching to Fun & focus never disconnects Claude Code by itself: it asks first. */
function ModeRow({ settings }: { settings: PetSettings }): React.JSX.Element {
  const [asking, setAsking] = useState(false)
  const [status, setStatus] = useState<ConnectStatus | null>(null)
  useEffect(() => {
    if (settings.mode === 'developer') window.api.connectStatus().then(setStatus)
  }, [settings.mode])

  const pick = (mode: UserMode): void => {
    if (mode === settings.mode) return
    if (mode === 'fun' && status?.connected) setAsking(true)
    else window.api.changeSettings({ mode })
  }
  const toFun = (disconnect: boolean): void => {
    setAsking(false)
    if (disconnect) void window.api.action('disconnectClaude')
    window.api.changeSettings({ mode: 'fun' })
  }

  return (
    <>
      <Row
        label="Mode"
        description={
          settings.mode === 'developer'
            ? 'Follows Claude Code, plus everything else.'
            : 'Music, Pomodoro and a cat that keeps you company.'
        }
      >
        <Choice
          value={settings.mode}
          options={[
            { value: 'developer', label: '🧑‍💻 Developer' },
            { value: 'fun', label: '🎵 Fun & focus' }
          ]}
          onChange={pick}
        />
      </Row>
      {asking && (
        <div className="confirm settings-confirm">
          <span>Also disconnect Claude Code?</span>
          <button className="btn btn-deny" onClick={() => toFun(true)}>
            Yes, disconnect
          </button>
          <button className="btn" onClick={() => toFun(false)}>
            No, keep it
          </button>
          <button className="btn" onClick={() => setAsking(false)}>
            Cancel
          </button>
        </div>
      )}
    </>
  )
}

export function GeneralSection({ settings: s }: { settings: PetSettings }): React.JSX.Element {
  const change = window.api.changeSettings
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    window.api.appInfo().then(setInfo)
  }, [])

  return (
    <Section title="⚙️ General">
      <ModeRow settings={s} />
      <Toggle
        label="🚀 Start on login"
        description={s.startOnLoginSupported ? 'Starts with your computer.' : 'Installed app only.'}
        checked={s.startOnLogin}
        disabled={!s.startOnLoginSupported}
        onChange={(startOnLogin) => change({ startOnLogin })}
      />

      <Group title="Updates">
        <Toggle
          label="Update automatically"
          description="Checks every few hours and downloads in the background."
          checked={s.autoUpdate}
          onChange={(autoUpdate) => change({ autoUpdate })}
        />
        <Row label={`Version ${info?.version ?? '…'}`}>
          <ActionButton action="checkUpdates">Check for updates now</ActionButton>
        </Row>
      </Group>

      <Group title="Pet">
        <Row label="Reset position" description="Back to the bottom-right corner of the screen.">
          <ActionButton action="resetPosition">Reset</ActionButton>
        </Row>
        <Row label="Replay onboarding" description="The welcome setup from the first start.">
          <ActionButton action="replayOnboarding">Replay</ActionButton>
        </Row>
        <Toggle
          label="Mood demo"
          description="Cycles through every mood, to show him off."
          checked={s.demo}
          onChange={(demo) => window.api.setDemo(demo)}
        />
      </Group>

      {s.mode === 'fun' && (
        <p className="connect-small settings-dev-link">
          Using Claude Code?{' '}
          <button className="link" onClick={() => change({ mode: 'developer' })}>
            Switch to developer mode
          </button>
        </p>
      )}
    </Section>
  )
}
