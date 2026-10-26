// Phone ping settings (tray › Phone ping…): get a push on your phone when the agent waits for you.
import type { PhoneResult, PhoneSettings } from '@shared/ipc'
import { useEffect, useState } from 'react'

const DELAYS = [1, 2, 5, 10]

export default function Phone(): React.JSX.Element {
  const [s, setS] = useState<PhoneSettings | null>(null)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    window.api.getPhone().then(setS)
  }, [])

  if (!s) return <div className="connect" />

  const update = (change: Partial<PhoneSettings>): void => {
    setS({ ...s, ...change })
    setResult(null)
  }
  const show = (r: PhoneResult, okText: string): void =>
    setResult(
      r.ok ? { text: okText, ok: true } : { text: r.error ?? 'Something went wrong.', ok: false }
    )
  const link = `${s.server}/${s.topic}`

  return (
    <div className="connect">
      <h1>📱 Phone ping</h1>
      <p>
        Your phone buzzes when Claude has been waiting for you for a while. Clicking Noodle,
        answering, or Claude carrying on cancels it.
      </p>

      <label className="connect-toggle">
        <input
          type="checkbox"
          checked={s.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
        />
        Ping my phone
      </label>

      <h2>1 · On your phone</h2>
      <p className="connect-small">
        Install the free <b>ntfy</b> app (Android / iOS), tap <b>+</b> and subscribe to this topic.
        No account needed. Or open <code>{link}</code> in your phone’s browser.
      </p>
      <label className="profile-name">
        Topic
        <input
          value={s.topic}
          maxLength={64}
          spellCheck={false}
          onChange={(e) => update({ topic: e.target.value.trim() })}
        />
      </label>
      <p className="connect-small">
        Anyone who knows the topic can read the pings, so keep this random name private.
      </p>

      <h2>2 · When</h2>
      <label className="profile-name">
        After
        <select value={s.delayMin} onChange={(e) => update({ delayMin: Number(e.target.value) })}>
          {DELAYS.map((d) => (
            <option key={d} value={d}>
              {d} min of waiting
            </option>
          ))}
        </select>
      </label>
      <label className="connect-toggle">
        <input
          type="checkbox"
          checked={s.done}
          onChange={(e) => update({ done: e.target.checked })}
        />
        Also when a long task (3+ min) finishes
      </label>
      <label className="connect-toggle">
        <input
          type="checkbox"
          checked={s.details}
          onChange={(e) => update({ details: e.target.checked })}
        />
        Include what Claude wants to run
        <span className="connect-small"> (otherwise only the project name is sent)</span>
      </label>

      {result && <p className={result.ok ? 'connect-ok-small' : 'connect-error'}>{result.text}</p>}

      <div className="connect-actions">
        <button
          className="btn btn-approve"
          onClick={() => window.api.setPhone(s).then((r) => show(r, 'Saved ✅'))}
        >
          Save
        </button>
        <button
          className="btn btn-terminal"
          onClick={() => window.api.testPhone(s).then((r) => show(r, 'Sent! Check your phone 📱'))}
        >
          Send test
        </button>
        <button className="btn btn-terminal" onClick={() => window.api.closeWindow()}>
          Close
        </button>
      </div>
    </div>
  )
}
