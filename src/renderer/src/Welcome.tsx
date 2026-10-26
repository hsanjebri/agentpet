// The first-run Welcome window: pick a cat, name it, say how you'll use it, then (developers)
// connect Claude Code, pick features, and the pet says hi. Fun & focus users never see Claude,
// terminals or hooks. Shown once per new install; Settings › General › Replay onboarding.
import type { PetSettings } from '@shared/ipc'
import { RISK_KINDS, type RiskKind, type UserMode } from '@shared/settings'
import { SKINS, type SkinId } from '@shared/skins'
import { useEffect, useState } from 'react'
import { ConnectPanel } from './Connect'
import { Noodle } from './pets/noodle/Noodle'
import type { CatSkin } from './pets/noodle/palette'
import { Toggle } from './settings/controls'

type Step = 'Cat' | 'Name' | 'You' | 'Claude Code' | 'Features' | 'Done'

function stepsFor(mode: UserMode): Step[] {
  return mode === 'developer'
    ? ['Cat', 'Name', 'You', 'Claude Code', 'Features', 'Done']
    : ['Cat', 'Name', 'You', 'Features', 'Done']
}

const SKIN_BLURBS: Partial<Record<SkinId, string>> = {
  noodle: 'white with black patches, the original',
  mochi: 'orange tabby, very round',
  zitouna: 'street cat, seen it all'
}

const DEFAULT_NAME = 'Noodle'

function StepBar({ steps, step }: { steps: Step[]; step: number }): React.JSX.Element {
  return (
    <ol className="welcome-steps">
      {steps.map((label, i) => (
        <li key={label} className={i === step ? 'current' : i < step ? 'done' : ''}>
          {i < step ? '✓' : i + 1} {label}
        </li>
      ))}
    </ol>
  )
}

function allOn(risks: Record<RiskKind, boolean>): boolean {
  return RISK_KINDS.every((k) => risks[k])
}

/** Everything on by default; uncheck what you don't want. Developers get the Claude extras. */
function FeaturePicker({ s, name }: { s: PetSettings; name: string }): React.JSX.Element {
  const change = window.api.changeSettings
  const dev = s.mode === 'developer'
  const autoHide = s.autoHide.fullscreen && s.autoHide.meetings && s.autoHide.dnd
  return (
    <div className="welcome-features">
      {dev && (
        <>
          <Toggle
            label="✅ Approve / Deny from the bubble"
            description={`Off = ${name} only alerts you; you answer in the terminal.`}
            checked={s.approvalBubble}
            onChange={(approvalBubble) => change({ approvalBubble })}
          />
          <Toggle
            label="📊 Usage bar"
            description="Your Claude session limit under the pet."
            checked={s.usageBar}
            onChange={(usageBar) => change({ usageBar })}
          />
          <Toggle
            label="😾 Risk warnings"
            description=".env, rm -rf, force push, deleted tests… (fine-tune in Settings)"
            checked={allOn(s.risks)}
            onChange={(on) => change({ risks: Object.fromEntries(RISK_KINDS.map((k) => [k, on])) })}
          />
          <div className="settings-row">
            <span className="settings-row-text">
              <b>📱 Phone ping</b>
              <span className="connect-small">
                Your phone buzzes when Claude waits for you. Off until you set it up.
              </span>
            </span>
            <button className="btn btn-terminal" onClick={() => window.api.openPhone()}>
              Set up…
            </button>
          </div>
        </>
      )}
      <Toggle
        label="🎵 Vibe to my music"
        description={
          s.musicSupported
            ? 'Headphones on when Spotify, YouTube, Deezer… play. Read on this PC only.'
            : 'Windows only for now: coming soon here.'
        }
        checked={s.music}
        disabled={!s.musicSupported}
        onChange={(music) => change({ music })}
      />
      <div className="settings-row">
        <span className="settings-row-text">
          <b>🍅 Pomodoro</b>
          <span className="connect-small">
            25 min focus, 5 min break. Right-click {name} to start one any time.
          </span>
        </span>
      </div>
      <Toggle
        label="🚶 Wander when idle"
        description="Strolls along the bottom of the screen now and then."
        checked={s.wander}
        onChange={(wander) => change({ wander })}
      />
      <Toggle
        label="🍽️ Feeding & hunger"
        description={
          dev ? 'A fish for every finished task or Pomodoro.' : 'A fish for every Pomodoro.'
        }
        checked={s.feeding}
        onChange={(feeding) => change({ feeding })}
      />
      <Toggle
        label="🌟 Rare moments"
        description="Golden rainbows, double farts, naps on the keyboard."
        checked={s.rareMoments}
        onChange={(rareMoments) => change({ rareMoments })}
      />
      <Toggle
        label="👋 Greetings"
        description="Good morning ☕ and “go to bed” late at night."
        checked={s.greetings}
        onChange={(greetings) => change({ greetings })}
      />
      <Toggle
        label="🔊 Sounds"
        description="Meow, toot, purr."
        checked={!s.muted}
        onChange={(on) => change({ muted: !on })}
      />
      <Toggle
        label="🙈 Auto-hide"
        description={
          s.autoHideSupported
            ? 'Out of the way during fullscreen apps, meetings and Do not disturb.'
            : 'Windows only for now: coming soon here.'
        }
        checked={autoHide}
        disabled={!s.autoHideSupported}
        onChange={(on) => change({ autoHide: { fullscreen: on, meetings: on, dnd: on } })}
      />
      <Toggle
        label="🚀 Start with my computer"
        description={s.startOnLoginSupported ? undefined : 'Installed app only.'}
        checked={s.startOnLogin}
        disabled={!s.startOnLoginSupported}
        onChange={(startOnLogin) => change({ startOnLogin })}
      />
    </div>
  )
}

export default function Welcome(): React.JSX.Element {
  const [step, setStep] = useState(0)
  const [settings, setSettings] = useState<PetSettings | null>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    window.api.getSettings().then(setSettings)
    window.api.getLook().then((look) => setName(look.petName === DEFAULT_NAME ? '' : look.petName))
    return window.api.onSettings(setSettings)
  }, [])

  const mode = settings?.mode ?? 'developer'
  const steps = stepsFor(mode)
  const current = steps[Math.min(step, steps.length - 1)]
  const skin = (settings?.skin ?? 'noodle') as CatSkin
  const petName = name.trim() || DEFAULT_NAME

  const next = (): void => {
    // people bond more with a pet they named
    if (current === 'Name') window.api.setPetName(petName)
    setStep((s) => Math.min(s + 1, steps.length - 1))
  }
  const choose = (chosen: UserMode): void => {
    window.api.changeSettings({ mode: chosen })
    setStep((s) => s + 1)
  }

  let body: React.JSX.Element
  switch (current) {
    case 'Cat':
      body = (
        <>
          <h1>Pick your cat</h1>
          <p className="connect-small">
            Your cat lives on your desktop and keeps you company. You can switch any time in
            Settings.
          </p>
          <div className="skin-cards">
            {SKINS.filter((s) => s.ready).map((s) => (
              <button
                key={s.id}
                className={`skin-card${s.id === skin ? ' selected' : ''}`}
                onClick={() => window.api.changeSettings({ skin: s.id })}
              >
                <Noodle
                  mood={s.id === skin ? 'happy' : 'sleeping'}
                  skin={s.id as CatSkin}
                  scale={2}
                />
                <span>
                  <b>{s.name}</b>
                  <br />
                  <span className="connect-small">{SKIN_BLURBS[s.id]}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )
      break
    case 'Name':
      body = (
        <>
          <h1>Name your cat</h1>
          <div className="welcome-hero">
            <Noodle mood="working" skin={skin} scale={3} />
          </div>
          <label className="profile-name">
            Name
            <input
              autoFocus
              value={name}
              maxLength={24}
              placeholder={DEFAULT_NAME}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
          </label>
        </>
      )
      break
    case 'You':
      body = (
        <>
          <h1>How will you use {petName}?</h1>
          <p className="connect-small">You can change this later in Settings › General.</p>
          <div className="mode-cards">
            <button
              className={`skin-card${mode === 'developer' ? ' selected' : ''}`}
              onClick={() => choose('developer')}
            >
              <span>
                <b>🧑‍💻 I&apos;m a developer</b>
                <br />
                <span className="connect-small">
                  {petName} follows Claude Code: works when it works, meows when it needs you,
                  Approve / Deny from the bubble. Plus everything below.
                </span>
              </span>
            </button>
            <button
              className={`skin-card${mode === 'fun' ? ' selected' : ''}`}
              onClick={() => choose('fun')}
            >
              <span>
                <b>🎵 Just for fun & focus</b>
                <br />
                <span className="connect-small">
                  A cat that keeps you company: vibes to your music, Pomodoro focus timer, wanders,
                  eats fish and grows up with you.
                </span>
              </span>
            </button>
          </div>
        </>
      )
      break
    case 'Claude Code':
      body = (
        <>
          <h1>Connect Claude Code</h1>
          <ConnectPanel name={petName} />
          <p className="connect-small">Not now? Skip with Next: it&apos;s in Settings any time.</p>
        </>
      )
      break
    case 'Features':
      body = (
        <>
          <h1>Pick your features</h1>
          <p className="connect-small">All on to start: uncheck anything. All in Settings later.</p>
          {settings && <FeaturePicker s={settings} name={petName} />}
        </>
      )
      break
    default:
      body = (
        <>
          <h1>All set!</h1>
          <div className="welcome-hero">
            <Noodle mood="happy" skin={skin} scale={3} />
          </div>
          <p>
            {mode === 'developer' ? (
              <>
                <b>{petName}</b> is on your desktop. He sleeps while Claude is idle, works while it
                works, and hops and meows when it needs you. Approve right from his bubble.
              </>
            ) : (
              <>
                <b>{petName}</b> is on your desktop. He vibes to your music, keeps you company
                during Pomodoros, and grows up as you spend time together.
              </>
            )}
          </p>
          <ul className="connect-small">
            {mode === 'developer' ? (
              <li>Click him to jump to the terminal where Claude is running.</li>
            ) : (
              <li>Right-click him to start a Pomodoro 🍅.</li>
            )}
            <li>Click and hold to pet him. Drag him wherever you like.</li>
            <li>Right-click him or use the tray icon for Settings.</li>
          </ul>
        </>
      )
  }

  const last = current === 'Done'
  return (
    <div className="connect welcome">
      <StepBar steps={steps} step={steps.indexOf(current)} />
      <div className="welcome-body">{body}</div>
      <div className="connect-actions">
        {step > 0 && (
          <button className="btn btn-terminal" onClick={() => setStep(steps.indexOf(current) - 1)}>
            Back
          </button>
        )}
        {current !== 'You' && (
          <button
            className="btn btn-approve welcome-next"
            onClick={last ? () => window.api.finishSetup() : next}
          >
            {last ? `Say hi to ${petName}!` : 'Next'}
          </button>
        )}
      </div>
    </div>
  )
}
