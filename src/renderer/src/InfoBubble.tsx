import type { SessionSummary } from '@shared/events'
import type { PetLook } from '@shared/progress'
import { sessionLine } from './sessionLine'

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
    const who = look ? `${look.petName} · lv ${look.level}` : '…'
    return <div className="bubble bubble-info">{`${hungry}${who} · zzz`}</div>
  }
  return <div className="bubble bubble-info">{hungry + sessionLine(session, now)}</div>
}
