// The first-run Welcome window: pick a cat, name it, connect Claude Code, a few extras, then
// the pet says hi. Shown once per new install; tray › Run setup again brings it back.
import type { PetSettings } from '@shared/ipc'
import { SKINS, type SkinId } from '@shared/skins'
import { useEffect, useState } from 'react'
import { ConnectPanel } from './Connect'
import { Noodle } from './pets/noodle/Noodle'
import type { CatSkin } from './pets/noodle/palette'

const STEPS = ['Cat', 'Name', 'Claude Code', 'Extras', 'Done'] as const

const SKIN_BLURBS: Partial<Record<SkinId, string>> = {
  noodle: 'white with black patches, the original',
  mochi: 'orange tabby, very round',
  zitouna: 'street cat, seen it all'
}

const DEFAULT_NAME = 'Noodle'

function StepBar({ step }: { step: number }): React.JSX.Element {
  return (
    <ol className="welcome-steps">
      {STEPS.map((label, i) => (
        <li key={label} className={i === step ? 'current' : i < step ? 'done' : ''}>
          {i < step ? '✓' : i + 1} {label}
        </li>
      ))}
    </ol>
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

  const skin = (settings?.skin ?? 'noodle') as CatSkin
  const petName = name.trim() || DEFAULT_NAME

  const next = (): void => {
    // people bond more with a pet they named
    if (STEPS[step] === 'Name') window.api.setPetName(petName)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  let body: React.JSX.Element
  switch (STEPS[step]) {
    case 'Cat':
      body = (
        <>
          <h1>Pick your cat</h1>
          <p className="connect-small">
            Your cat lives on your desktop and keeps an eye on Claude Code for you. You can switch
            any time from the tray menu.
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
    case 'Claude Code':
      body = (
        <>
          <h1>Connect Claude Code</h1>
          <ConnectPanel name={petName} />
        </>
      )
      break
    case 'Extras':
      body = (
        <>
          <h1>A few extras</h1>
          <p className="connect-small">All optional, all in the tray menu later.</p>
          {settings?.musicSupported && (
            <label className="connect-toggle">
              <input
                type="checkbox"
                checked={settings.music}
                onChange={(e) => window.api.changeSettings({ music: e.target.checked })}
              />
              🎵 Vibe to my music
              <span className="connect-small">
                {' '}
                (Spotify, YouTube, Deezer… read on this PC only, nothing is sent anywhere)
              </span>
            </label>
          )}
          <label className="connect-toggle">
            <input
              type="checkbox"
              disabled={!settings?.startOnLoginSupported}
              checked={Boolean(settings?.startOnLogin)}
              onChange={(e) => window.api.changeSettings({ startOnLogin: e.target.checked })}
            />
            🚀 Start {petName} with my computer
            {!settings?.startOnLoginSupported && (
              <span className="connect-small"> (installed app only)</span>
            )}
          </label>
          <div className="welcome-extra">
            <span>
              <b>📱 Phone ping</b>
              <br />
              <span className="connect-small">
                Your phone buzzes when Claude has waited for you a few minutes (free ntfy app).
              </span>
            </span>
            <button className="btn btn-terminal" onClick={() => window.api.openPhone()}>
              Set up…
            </button>
          </div>
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
            <b>{petName}</b> is on your desktop. He sleeps while Claude is idle, works while it
            works, and hops and meows when it needs you. Approve right from his bubble.
          </p>
          <ul className="connect-small">
            <li>Click him to jump to the terminal where Claude is running.</li>
            <li>Hover him to see what Claude is up to.</li>
            <li>Click and hold to pet him. Drag him wherever you like.</li>
            <li>Everything else is in the tray menu.</li>
          </ul>
        </>
      )
  }

  const last = step === STEPS.length - 1
  return (
    <div className="connect welcome">
      <StepBar step={step} />
      <div className="welcome-body">{body}</div>
      <div className="connect-actions">
        {step > 0 && (
          <button className="btn btn-terminal" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        <button
          className="btn btn-approve welcome-next"
          onClick={last ? () => window.api.finishSetup() : next}
        >
          {last ? `Say hi to ${petName}!` : 'Next'}
        </button>
      </div>
    </div>
  )
}
