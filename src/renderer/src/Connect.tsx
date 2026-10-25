// The "Connect Claude Code" window: explains what changes, shows the exact entries, connects.
import type { ConnectResult, ConnectStatus } from '@shared/ipc'
import { useEffect, useState } from 'react'

export default function Connect(): React.JSX.Element {
  const [status, setStatus] = useState<ConnectStatus | null>(null)
  const [result, setResult] = useState<ConnectResult | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    window.api.connectStatus().then(setStatus)
  }, [])

  const connected = status?.connected || result?.ok

  return (
    <div className="connect">
      <h1>Connect Claude Code</h1>

      {connected ? (
        <>
          <p className="connect-ok">✅ Connected!</p>
          <p>
            Start a <b>new</b> Claude Code session: Noodle will follow it, show your session usage,
            and let you approve permission requests from his bubble.
          </p>
          {result?.backupPath && (
            <p className="connect-small">
              Your previous settings were backed up to <code>{result.backupPath}</code>
            </p>
          )}
          <div className="connect-actions">
            <button className="btn btn-approve" onClick={() => window.api.closeWindow()}>
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <p>Noodle can follow your Claude Code sessions. Connecting adds to</p>
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
              onClick={() => window.api.connect().then(setResult)}
            >
              Connect
            </button>
            <button className="btn btn-terminal" onClick={() => window.api.closeWindow()}>
              Not now
            </button>
          </div>
        </>
      )}
    </div>
  )
}
