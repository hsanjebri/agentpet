import type { SessionSummary } from '@shared/events'

/** "my-app · editing App.tsx · 12 tools · 4 min", shown while hovering the pet. */
export function InfoBubble({
  session,
  now
}: {
  session: SessionSummary | null
  now: number
}): React.JSX.Element {
  if (!session) return <div className="bubble bubble-info">no agent yet · zzz</div>

  const minutes = Math.max(0, Math.round((now - session.startedAt) / 60_000))
  const parts = [
    session.project,
    session.lastAction,
    `${session.toolCount} tool${session.toolCount === 1 ? '' : 's'}`,
    `${minutes} min`
  ].filter(Boolean)

  return <div className="bubble bubble-info">{parts.join(' · ')}</div>
}
