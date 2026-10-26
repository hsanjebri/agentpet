// Settings › Phone ping (developer mode only): a push on your phone (ntfy) when Claude has waited
// for you. Every change is saved right away; the QR code subscribes the phone in one scan.
import type { PhoneSettings } from '@shared/ipc'
import qrcode from 'qrcode-generator'
import { useEffect, useMemo, useState } from 'react'
import { ActionButton, Row, Section, Toggle } from './controls'

const DELAYS = [1, 2, 3, 5, 10]

/** The link as a QR code, drawn as crisp pixels like everything else. */
function QrCode({ text }: { text: string }): React.JSX.Element {
  const cells = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    const n = qr.getModuleCount()
    const dark: Array<[number, number]> = []
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) dark.push([x, y])
    return { n, dark }
  }, [text])
  const quiet = 2
  const size = cells.n + quiet * 2
  return (
    <svg
      className="qr"
      viewBox={`0 0 ${size} ${size}`}
      width={size * 4}
      height={size * 4}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code of the ntfy link"
    >
      <rect width={size} height={size} fill="#fff" />
      {cells.dark.map(([x, y]) => (
        <rect key={`${x},${y}`} x={x + quiet} y={y + quiet} width={1} height={1} fill="#1f1c1a" />
      ))}
    </svg>
  )
}

export function PhoneSection({ name }: { name: string }): React.JSX.Element {
  const [s, setS] = useState<PhoneSettings | null>(null)
  const [topic, setTopic] = useState('')
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    window.api.getPhone().then((p) => {
      setS(p)
      setTopic(p.topic)
    })
  }, [])

  if (!s) return <Section title="📱 Phone ping">…</Section>

  const save = (change: Partial<PhoneSettings>): void => {
    const next = { ...s, ...change }
    window.api.setPhone(next).then((r) => {
      if (r.ok) {
        setS(next)
        setNote(null)
      } else {
        setNote({ text: r.error ?? 'Could not save.', ok: false })
        setTopic(s.topic)
      }
    })
  }
  const link = `${s.server}/${s.topic}`

  return (
    <Section
      title="📱 Phone ping"
      intro={`Your phone buzzes when Claude has waited for you a while. Clicking ${name} or answering cancels it.`}
    >
      <Toggle
        label="Ping my phone"
        description="Only the project name is sent, to your own ntfy topic."
        checked={s.enabled}
        onChange={(enabled) => save({ enabled })}
      />

      <div className="phone-qr">
        <QrCode text={link} />
        <div>
          <p>
            Install the free <b>ntfy</b> app, tap <b>+</b> and scan this, or subscribe to the topic
            below. No account needed.
          </p>
          <label className="profile-name">
            Topic
            <input
              className="settings-input"
              value={topic}
              maxLength={64}
              spellCheck={false}
              onChange={(e) => setTopic(e.target.value.trim())}
              onBlur={() => topic !== s.topic && save({ topic })}
            />
          </label>
          <p className="connect-small">
            Anyone who knows the topic can read the pings: keep it private.
          </p>
          <ActionButton
            action="newPhoneTopic"
            confirm="Your phone must subscribe to the new topic. Go?"
            onDone={(r) => {
              if (r.ok && r.message) {
                setS({ ...s, topic: r.message })
                setTopic(r.message)
              }
            }}
          >
            Generate new topic
          </ActionButton>
        </div>
      </div>

      <Row label="Wait before pinging">
        <select value={s.delayMin} onChange={(e) => save({ delayMin: Number(e.target.value) })}>
          {DELAYS.map((d) => (
            <option key={d} value={d}>
              {d} min
            </option>
          ))}
        </select>
      </Row>
      <Toggle
        label="Ping when a long task finishes"
        description="Tasks of 3 minutes or more."
        checked={s.done}
        onChange={(done) => save({ done })}
      />
      <Toggle
        label="Include what Claude wants to run"
        description="Otherwise only the project name is sent."
        checked={s.details}
        onChange={(details) => save({ details })}
      />

      <div className="settings-actions">
        <button
          className="btn btn-terminal"
          onClick={() =>
            window.api
              .testPhone(s)
              .then((r) =>
                setNote(
                  r.ok
                    ? { text: 'Sent! Check your phone 📱', ok: true }
                    : { text: r.error ?? 'Something went wrong.', ok: false }
                )
              )
          }
        >
          Send test ping
        </button>
        {note && (
          <span className={note.ok ? 'connect-ok-small' : 'connect-error'}>{note.text}</span>
        )}
      </div>
    </Section>
  )
}
