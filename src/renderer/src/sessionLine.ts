import type { SessionSummary } from '@shared/events'

/** "my-app · editing App.tsx · 12 tools · 4 min" */
export function sessionLine(session: SessionSummary, now: number): string {
  const minutes = Math.max(0, Math.round((now - session.startedAt) / 60_000))
  return [
    session.project,
    session.lastAction,
    `${session.toolCount} tool${session.toolCount === 1 ? '' : 's'}`,
    `${minutes} min`
  ]
    .filter(Boolean)
    .join(' · ')
}
