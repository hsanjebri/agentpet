// What the usage bar shows, and when usage is worth a nervous sweat.
import type { UsageInfo } from '@shared/events'

export interface UsageMeter {
  label: string
  pct: number // 0–100, clamped
  detail?: string // e.g. "resets 15:30"
}

/** Prefer the 5-hour plan limit ("session" in /usage); fall back to the context window. */
export function usageMeter(usage: UsageInfo): UsageMeter | null {
  const clamp = (pct: number): number => Math.max(0, Math.min(100, pct))
  if (usage.sessionPct !== undefined) {
    const detail = usage.sessionResetsAt
      ? `resets ${new Date(usage.sessionResetsAt * 1000).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })}`
      : undefined
    return { label: 'session', pct: clamp(usage.sessionPct), detail }
  }
  if (usage.contextPct !== undefined) {
    const detail = usage.costUsd !== undefined ? `$${usage.costUsd.toFixed(2)}` : undefined
    return { label: 'context', pct: clamp(usage.contextPct), detail }
  }
  return null
}

export function meterLevel(pct: number): 'ok' | 'warn' | 'high' {
  if (pct >= 80) return 'high'
  if (pct >= 50) return 'warn'
  return 'ok'
}

export const SESSION_WARNINGS = [50, 80, 95] // % of the 5-hour limit
export const COST_WARNINGS = [1, 5, 20] // USD per session

function crossed(before: number | undefined, after: number | undefined, at: number[]): boolean {
  if (before === undefined || after === undefined) return false
  return at.some((threshold) => before < threshold && after >= threshold)
}

/** True when usage just went past a warning threshold (seen live, not on startup). */
export function crossedWarning(previous: UsageInfo | null, next: UsageInfo): boolean {
  if (!previous) return false
  return (
    crossed(previous.sessionPct, next.sessionPct, SESSION_WARNINGS) ||
    crossed(previous.costUsd, next.costUsd, COST_WARNINGS)
  )
}
