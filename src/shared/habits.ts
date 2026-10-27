// Bedtime and countdowns: small date helpers, pure (the clock is passed in).

const MORNING = 6 * 60 // bedtime ends at 6:00
const DAY_MIN = 24 * 60

/** Minutes past bedtime ("23:30"), or null outside bedtime .. 6:00. */
export function minutesPastBedtime(at: string, now: number): number | null {
  const [h, m] = at.split(':').map(Number)
  const bed = h * 60 + m
  const d = new Date(now)
  const cur = d.getHours() * 60 + d.getMinutes()
  const inWindow = bed >= MORNING ? cur >= bed || cur < MORNING : cur >= bed && cur < MORNING
  return inWindow ? (cur - bed + DAY_MIN) % DAY_MIN : null
}

/** Whole days from today to a "YYYY-MM-DD" date (local); negative once it's past. */
export function daysUntil(date: string, now: number): number {
  const [y, mo, d] = date.split('-').map(Number)
  const target = new Date(y, mo - 1, d).getTime()
  const t = new Date(now)
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  return Math.round((target - today) / (24 * 60 * 60_000))
}
