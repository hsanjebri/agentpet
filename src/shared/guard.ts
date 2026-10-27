// Distraction guard: is the window in front a distraction? Matched on its title (browsers put
// the site in the tab title, e.g. "Home - YouTube - Google Chrome"). Pure.

export interface ForegroundWindow {
  title: string
  /** screen pixels (physical) */
  x: number
  y: number
  width: number
  height: number
  pid: number
}

/** The site a window title is about, from the list (whole words, any case), or null. */
export function distractionIn(title: string, sites: readonly string[]): string | null {
  const t = title.toLowerCase()
  for (const site of sites) {
    const s = site.trim().toLowerCase()
    if (!s) continue
    const at = t.indexOf(s)
    if (at < 0) continue
    // whole word: "x" must not match "xbox", "reddit" may be "Reddit - Dive into anything"
    const before = at === 0 ? ' ' : t[at - 1]
    const after = t[at + s.length] ?? ' '
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return site.trim()
  }
  return null
}

/** One line from the watcher, or null. */
export function parseWindowLine(line: string): ForegroundWindow | null {
  try {
    const raw = JSON.parse(line) as Record<string, unknown>
    const n = (k: string): number => (typeof raw[k] === 'number' ? (raw[k] as number) : NaN)
    const w: ForegroundWindow = {
      title: typeof raw.title === 'string' ? raw.title : '',
      x: n('x'),
      y: n('y'),
      width: n('w'),
      height: n('h'),
      pid: n('pid')
    }
    return [w.x, w.y, w.width, w.height, w.pid].every(Number.isFinite) ? w : null
  } catch {
    return null
  }
}
