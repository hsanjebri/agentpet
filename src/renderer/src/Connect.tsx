// Connecting Claude Code: explains what changes, shows the exact entries first, then whether it
// really works (an event got through). Used by the Welcome window and the tray's Connect window.
import type { ConnectResult, ConnectStatus } from '@shared/ipc'
import { useEffect, useState } from 'react'

/** How often to re-check while the user starts a Claude Code session. */
const POLL_MS = 2000

export function ConnectPanel({ name }: { name: string }): React.JSX.Element {
  const [status, setStatus] = useState<ConnectStatus | null>(null)
  const [result, setResult] = useState<ConnectResult | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    const check = (): void => void window.api.connectStatus().then(setStatus)
    check()
    const timer = setInterval(check, POLL_MS)
    return () => clearInterval(timer)
  }, [])

  const connect = (): void => {
    window.api.connect().then((r) => {
      setResult(r)
      window.api.connectStatus().then(setStatus)
    })
  }

  if (status?.connected && !status.outdated) {
    return (
      <>
        <p className="connect-ok">✅ Connected!</p>
        {status.heardFromAgent ? (
          <p className="connect-ok-small">✓ {name} has heard from Claude Code. All good!</p>
        ) : (
          <p>
            Start a <b>new</b> Claude Code session and send a prompt: {name} wakes up and starts
            working when it gets through. <span className="connect-small">(checking…)</span>
          </p>
        )}
        {result?.backupPath && (
          <p className="connect-small">
            Your previous settings were backed up to <code>{result.backupPath}</code>
          </p>
        )}
      </>
    )
  }

  if (status?.outdated) {
    return (
      <>
        <p className="connect-warn">⚠ Needs fixing</p>
        <p>
          Claude Code has AgentPet hooks from an older version, or ones that point to files that
          aren&apos;t there anymore, so {name} can&apos;t hear it. Repair puts in the right ones
          (your file is backed up first).
        </p>
        {result?.error && <p className="connect-error">Could not repair: {result.error}</p>}
        <div className="connect-actions">
          <button className="btn btn-approve" onClick={connect}>
            Repair
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <p>{name} can follow your Claude Code sessions. Connecting adds to</p>
      <p>
        <code>{status?.settingsPath ?? '~/.claude/settings.json'}</code>
      </p>
      <ul>
        <li>small hooks that tell {name} what Claude is doing,</li>
        <li>a permission hook so you can Approve / Deny from {name},</li>
        <li>a status line that shows your session usage.</li>
      </ul>
      <p className="connect-small">
        Your file is backed up first, your own hooks are left alone, and you can disconnect any time
        from the tray menu. Everything stays on this computer.
      </p>

      <button className="connect-details" onClick={() => setShowDetails(!showDetails)}>
        {showDetails ? '▾' : '▸'} exactly what gets added
      </button>
      {showDetails && <pre>{status?.preview}</pre>}

      {result?.error && <p className="connect-error">Could not connect: {result.error}</p>}

      <div className="connect-actions">
        <button className="btn btn-approve" disabled={!status} onClick={connect}>
          Connect
        </button>
      </div>
    </>
  )
}

/** The tray's "Connect Claude Code…" window. */
export default function Connect(): React.JSX.Element {
  const [name, setName] = useState('Noodle')
  useEffect(() => {
    window.api.getLook().then((look) => setName(look.petName))
  }, [])

  return (
    <div className="connect">
      <h1>Connect Claude Code</h1>
      <ConnectPanel name={name} />
      <div className="connect-actions">
        <button className="btn btn-terminal" onClick={() => window.api.closeWindow()}>
          Close
        </button>
      </div>
    </div>
  )
}
