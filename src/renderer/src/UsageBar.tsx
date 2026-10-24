import type { UsageInfo } from '@shared/events'
import { meterLevel, usageMeter } from './usage'

/** Pixel-style progress bar under the pet: how much of the session limit is used. */
export function UsageBar({ usage }: { usage: UsageInfo }): React.JSX.Element | null {
  const meter = usageMeter(usage)
  if (!meter) return null
  const pct = Math.round(meter.pct)

  return (
    <div className={`usage usage-${meterLevel(meter.pct)}`}>
      <span className="usage-label">{meter.label}</span>
      <div
        className="usage-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="usage-fill" style={{ width: `${meter.pct}%` }} />
      </div>
      <span className="usage-pct">{pct}%</span>
      {meter.detail && <span className="usage-detail">{meter.detail}</span>}
    </div>
  )
}
