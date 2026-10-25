import type { SessionSummary } from '@shared/events'
import type { PetLook } from '@shared/progress'

/** "my-app · editing App.tsx · 12 tools · 4 min", shown while hovering the pet. */
export function InfoBubble({
  session,
  look,
  now
}: {
  session: SessionSummary | null
  look: PetLook | null
  now: number
}): React.JSX.Element {
  // a gentle hint, never a nag
  const hungry = look?.hungry ? 'a bit hungry 🐟 · ' : ''

  if (!session) {
    const who = look ? `${look.petName} · lv ${look.level}` : 'no agent yet'
    return <div className="bubble bubble-info">{`${hungry}${who} · zzz`}</div>
  }

  const minutes = Math.max(0, Math.round((now - session.startedAt) / 60_000))
  const parts = [
    session.project,
    session.lastAction,
    `${session.toolCount} tool${session.toolCount === 1 ? '' : 's'}`,
    `${minutes} min`
  ].filter(Boolean)

  return <div className="bubble bubble-info">{hungry + parts.join(' · ')}</div>
}
