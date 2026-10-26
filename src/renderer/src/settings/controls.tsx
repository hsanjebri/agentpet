// Building blocks for the Settings sections: rows with a toggle and a one-line description,
// segmented choices, buttons that run an action and show its answer, and two-step confirms.
import type { ActionResult, SettingsAction } from '@shared/ipc'
import { type ReactNode, useState } from 'react'

export function Section({
  title,
  intro,
  children
}: {
  title: string
  intro?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <section className="settings-section">
      <h1>{title}</h1>
      {intro && <p className="connect-small">{intro}</p>}
      {children}
    </section>
  )
}

export function Group({
  title,
  children
}: {
  title: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="settings-group">
      <h2>{title}</h2>
      {children}
    </div>
  )
}

/** A switch with a label and a one-line description. */
export function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange
}: {
  label: ReactNode
  description?: ReactNode
  checked: boolean
  disabled?: boolean
  onChange(on: boolean): void
}): React.JSX.Element {
  return (
    <label className={`settings-row${disabled ? ' disabled' : ''}`}>
      <span className="settings-row-text">
        <b>{label}</b>
        {description && <span className="connect-small">{description}</span>}
      </span>
      <input
        type="checkbox"
        className="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

/** A row with any control on the right. */
export function Row({
  label,
  description,
  children
}: {
  label: ReactNode
  description?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="settings-row">
      <span className="settings-row-text">
        <b>{label}</b>
        {description && <span className="connect-small">{description}</span>}
      </span>
      <span className="settings-row-control">{children}</span>
    </div>
  )
}

/** Pixel buttons where exactly one is picked (size S/M/L, mode…). */
export function Choice<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: ReactNode }>
  onChange(value: T): void
}): React.JSX.Element {
  return (
    <span className="choice">
      {options.map((o) => (
        <button
          key={o.value}
          className={`btn${o.value === value ? ' selected' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}

/** Runs a Settings action and shows what it answered. `confirm` asks once more first. */
export function ActionButton({
  action,
  children,
  confirm,
  danger,
  onDone
}: {
  action: SettingsAction
  children: ReactNode
  confirm?: string
  danger?: boolean
  onDone?(result: ActionResult): void
}): React.JSX.Element {
  const [asking, setAsking] = useState(false)
  const [result, setResult] = useState<ActionResult | null>(null)
  const [busy, setBusy] = useState(false)

  const run = (): void => {
    setAsking(false)
    setBusy(true)
    window.api.action(action).then((r) => {
      setBusy(false)
      setResult(r)
      onDone?.(r)
    })
  }

  return (
    <span className="action">
      {asking ? (
        <span className="confirm">
          <span>{confirm}</span>
          <button className="btn btn-deny" onClick={run}>
            Yes
          </button>
          <button className="btn" onClick={() => setAsking(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button
          className={`btn ${danger ? 'btn-deny' : 'btn-terminal'}`}
          disabled={busy}
          onClick={() => (confirm ? setAsking(true) : run())}
        >
          {busy ? '…' : children}
        </button>
      )}
      {result?.message && (
        <span className={`connect-small ${result.ok ? 'ok' : 'connect-error'}`}>
          {result.message}
        </span>
      )}
    </span>
  )
}
