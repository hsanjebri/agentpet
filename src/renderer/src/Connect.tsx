// The first-run window: name your cat, then connect Claude Code (explains what changes and
// shows the exact entries first).
import type { ConnectResult, ConnectStatus, PetSettings } from '@shared/ipc'
import { useEffect, useState } from 'react'

export default function Connect(): React.JSX.Element {
  const [status, setStatus] = useState<ConnectStatus | null>(null)
  const [settings, setSettings] = useState<PetSettings | null>(null)
  const [result, setResult] = useState<ConnectResult | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [name, setName] = useState('')
  const [savedName, setSavedName] = useState('Noodle')

  useEffect(() => {
    window.api.connectStatus().then(setStatus)
    window.api.getSettings().then(setSettings)
    window.api.getLook().then((look) => {
      setName(look.petName)
      setSavedName(look.petName)
    })
  }, [])

  /** People bond more with a pet they named. */
  const saveName = (): void => {
    const clean = name.trim() || 'Noodle'
    if (clean !== savedName) window.api.setPetName(clean)
    setSavedName(clean)
  }

  const connected = status?.connected || result?.ok

  return (
    <div className="connect">
      <h1>Meet your cat</h1>
      <label className="profile-name">
        Name
        <input
          value={name}
          maxLength={24}
          placeholder="Noodle"
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
        />
      </label>

      {settings?.musicSupported && (
        <label className="connect-toggle">
          <input
            type="checkbox"
            checked={settings.music}
            onChange={(e) => {
              const on = e.target.checked
              setSettings({ ...settings, music: on })
              window.api.setMusic(on)
            }}
          />
          🎵 Vibe to my music
          <span className="connect-small">
            {' '}
            (Spotify, YouTube, Deezer… read on this PC only, nothing is sent anywhere)
          </span>
        </label>
      )}

      <h1 className="connect-step">Connect Claude Code</h1>

      {connected ? (
        <>
          <p className="connect-ok">✅ Connected!</p>
          <p>
            Start a <b>new</b> Claude Code session: {savedName} will follow it, show your session
            usage, and let you approve permission requests from his bubble.
          </p>
          {result?.backupPath && (
            <p className="connect-small">
              Your previous settings were backed up to <code>{result.backupPath}</code>
            </p>
          )}
          <div className="connect-actions">
            <button
              className="btn btn-approve"
              onClick={() => {
                saveName()
                window.api.closeWindow()
              }}
            >
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <p>{name.trim() || 'Noodle'} can follow your Claude Code sessions. Connecting adds to</p>
          <p>
            <code>{status?.settingsPath ?? '~/.claude/settings.json'}</code>
          </p>
          <ul>
            <li>small hooks that tell Noodle what Claude is doing,</li>
            <li>a permission hook so you can Approve / Deny from Noodle,</li>
            <li>a status line that shows your session usage.</li>
          </ul>
          <p className="connect-small">
            Your file is backed up first, your own hooks are left alone, and you can disconnect any
            time from the tray menu. Everything stays on this computer.
          </p>

          <button className="connect-details" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? '▾' : '▸'} exactly what gets added
          </button>
          {showDetails && <pre>{status?.preview}</pre>}

          {status && !status.nodeVersion && (
            <p className="connect-error">
              ⚠ Node.js was not found. The hooks need it: install it from nodejs.org, then reopen
              this window.
            </p>
          )}
          {result?.error && <p className="connect-error">Could not connect: {result.error}</p>}

          <div className="connect-actions">
            <button
              className="btn btn-approve"
              disabled={!status}
              onClick={() => {
                saveName()
                window.api.connect().then(setResult)
              }}
            >
              Connect
            </button>
            <button
              className="btn btn-terminal"
              onClick={() => {
                saveName()
                window.api.closeWindow()
              }}
            >
              Not now
            </button>
          </div>
        </>
      )}
    </div>
  )
}
