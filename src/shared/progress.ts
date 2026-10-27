// What the pet remembers about your work together: daily stats, XP and level, streaks,
// unlocked accessories, fish. Pure functions only (main persists it, renderer shows it).

export type Accessory = 'tophat' | 'sunglasses' | 'crown'
export type Stage = 'kitten' | 'cat' | 'senior'
/** Rare things that make people take screenshots. */
export type RareMoment = 'golden' | 'double' | 'keyboard'

export interface RiskyMoment {
  reason: string
  at: number
}

export interface DayStats {
  tasks: number // turns finished
  rainbows: number // one per task, two for a rare double fart
  approvals: number
  tools: number
  files: Record<string, number> // file name -> edits
  risky: RiskyMoment[]
  rare: number
  /** songs listened to (just the count: no song history is kept) */
  songs: number
  /** Pomodoro focus rounds finished */
  pomodoros: number
  /** times he was petted (click and hold) */
  pets: number
  /** fish eaten (finished tasks and Pomodoro rounds) */
  fish: number
  /** glasses of water (tapped "I drank") */
  water: number
  /** visits made or hosted (Friends) */
  visits: number
  /** tool calls per hour of the day, for "busiest hour" */
  hours: number[]
}

export interface Progress {
  petName: string
  xp: number
  totalTasks: number
  totalApprovals: number
  totalRainbows: number
  totalPomodoros: number
  lastFedAt: number | null
  unlocked: Accessory[]
  /** accessories the user chose to wear (from the unlocked ones) */
  wearing: Accessory[]
  /** local date (YYYY-MM-DD) -> stats; the last 60 days are kept */
  days: Record<string, DayStats>
}

export type Activity =
  | { type: 'task_done'; rare: RareMoment | null }
  | { type: 'approved' }
  | { type: 'tool'; toolName?: string; target?: string }
  | { type: 'risky'; reason: string }
  | { type: 'song' }
  | { type: 'pomodoro' }
  | { type: 'petted' }
  | { type: 'water' }
  | { type: 'visit' }

/** Things worth celebrating, produced by recording an activity. */
export type Milestone =
  | { type: 'level_up'; level: number }
  | { type: 'unlocked'; item: Accessory }
  | { type: 'streak'; days: number }

/** Study streak: from this many days in a row with a Pomodoro he wears a scarf. */
export const SCARF_STREAK = 5
const STREAK_MILESTONES = new Set([3, 5, 7, 14, 30, 50, 100])

export const DEFAULT_NAME = 'Noodle'
export const XP_PER_LEVEL = 100
export const XP: Record<Activity['type'], number> = {
  task_done: 10,
  approved: 2,
  tool: 0,
  risky: 0,
  song: 1,
  pomodoro: 10,
  petted: 1,
  water: 2,
  visit: 5
}
/** XP for these stops after this many a day (so nobody levels up by clicking all day). */
export const DAILY_XP_CAP: Partial<Record<Activity['type'], number>> = {
  song: 10,
  petted: 10,
  water: 12,
  visit: 3
}
/** First activity of a day that keeps a streak going. */
export const STREAK_XP = 5
export const HUNGRY_AFTER_MS = 3 * 24 * 60 * 60_000
export const RARE_CHANCE = 1 / 50
const KEEP_DAYS = 60
const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit'])

export const UNLOCKS: ReadonlyArray<{
  item: Accessory
  label: string
  done(p: Progress, now: number): boolean
}> = [
  {
    item: 'tophat',
    label: '100 tasks or 100 Pomodoros',
    done: (p) => p.totalTasks >= 100 || p.totalPomodoros >= 100
  },
  { item: 'sunglasses', label: '7-day streak', done: (p, now) => streak(p, now) >= 7 },
  {
    item: 'crown',
    label: '1,000 approvals or 300 Pomodoros',
    done: (p) => p.totalApprovals >= 1000 || p.totalPomodoros >= 300
  }
]

/** Unlock hints without any Claude wording (Fun & focus mode). */
export const FUN_UNLOCK_LABELS: Record<Accessory, string> = {
  tophat: '100 Pomodoros',
  sunglasses: '7-day streak',
  crown: '300 Pomodoros'
}

export function emptyProgress(): Progress {
  return {
    petName: DEFAULT_NAME,
    xp: 0,
    totalTasks: 0,
    totalApprovals: 0,
    totalRainbows: 0,
    totalPomodoros: 0,
    lastFedAt: null,
    unlocked: [],
    wearing: [],
    days: {}
  }
}

export function emptyDay(): DayStats {
  return {
    tasks: 0,
    rainbows: 0,
    approvals: 0,
    tools: 0,
    files: {},
    risky: [],
    rare: 0,
    songs: 0,
    pomodoros: 0,
    pets: 0,
    fish: 0,
    water: 0,
    visits: 0,
    hours: Array(24).fill(0)
  }
}

/** Local calendar date, e.g. "2026-10-25". */
export function dayKey(time: number): string {
  const d = new Date(time)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function levelOf(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1
}

/** 0–1 progress toward the next level. */
export function levelProgress(xp: number): number {
  return (xp % XP_PER_LEVEL) / XP_PER_LEVEL
}

/** Kitten until level 5, cat until 20, then a chonky senior cat with glasses. */
export function stageOf(level: number): Stage {
  if (level < 5) return 'kitten'
  if (level < 20) return 'cat'
  return 'senior'
}

function isActive(day: DayStats | undefined): boolean {
  return Boolean(
    day && (day.tasks > 0 || day.tools > 0 || day.pomodoros > 0 || day.pets > 0 || day.songs > 0)
  )
}

/** Days in a row with activity (agent work, Pomodoros, petting or music), counting back from today (or yesterday). */
export function streak(progress: Progress, now: number): number {
  let count = 0
  let time = now
  // today may not have started yet: then the streak runs up to yesterday
  if (!isActive(progress.days[dayKey(time)])) time -= 24 * 60 * 60_000
  while (isActive(progress.days[dayKey(time)])) {
    count++
    time -= 24 * 60 * 60_000
  }
  return count
}

/** Days in a row with at least one Pomodoro, up to today (or yesterday). */
export function focusStreak(progress: Progress, now: number): number {
  const did = (t: number): boolean => (progress.days[dayKey(t)]?.pomodoros ?? 0) > 0
  let count = 0
  let time = now
  if (!did(time)) time -= 24 * 60 * 60_000
  while (did(time)) {
    count++
    time -= 24 * 60 * 60_000
  }
  return count
}

export function isHungry(progress: Progress, now: number): boolean {
  return progress.lastFedAt !== null && now - progress.lastFedAt > HUNGRY_AFTER_MS
}

/** 1 task in 50 gets something special. `random` is injectable for tests. */
export function rollRare(random: () => number = Math.random): RareMoment | null {
  if (random() >= RARE_CHANCE) return null
  const kinds: RareMoment[] = ['golden', 'double', 'keyboard']
  return kinds[Math.floor(random() * kinds.length) % kinds.length]
}

function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

/** Records one activity. Returns the new progress and anything worth celebrating. */
export function record(
  progress: Progress,
  activity: Activity,
  now: number
): { progress: Progress; milestones: Milestone[] } {
  const next: Progress = structuredClone(progress)
  const key = dayKey(now)
  // older files lack the newer counters
  const day = (next.days[key] = { ...emptyDay(), ...next.days[key] })
  next.totalPomodoros ??= 0
  const wasActiveToday = isActive(day)
  let studyDay = false

  switch (activity.type) {
    case 'task_done':
      day.tasks++
      next.totalTasks++
      day.rainbows += activity.rare === 'double' ? 2 : 1
      next.totalRainbows += activity.rare === 'double' ? 2 : 1
      next.lastFedAt = now // every finished task earns a fish
      day.fish++
      if (activity.rare) day.rare++
      break
    case 'pomodoro':
      day.pomodoros++
      // the first focus round of the day may reach a streak milestone
      if (day.pomodoros === 1) studyDay = true
      next.totalPomodoros++
      next.lastFedAt = now // and so does every focus round
      day.fish++
      break
    case 'petted':
      day.pets++
      break
    case 'water':
      day.water++
      break
    case 'visit':
      day.visits++
      break
    case 'approved':
      day.approvals++
      next.totalApprovals++
      break
    case 'tool':
      day.tools++
      day.hours[new Date(now).getHours()]++
      if (activity.toolName && EDIT_TOOLS.has(activity.toolName) && activity.target) {
        const name = fileName(activity.target)
        day.files[name] = (day.files[name] ?? 0) + 1
      }
      break
    case 'song':
      day.songs = (day.songs ?? 0) + 1
      break
    case 'risky':
      day.risky = [...day.risky, { reason: activity.reason, at: now }].slice(-20)
      break
  }

  const milestones: Milestone[] = []
  const before = levelOf(next.xp)
  const cap = DAILY_XP_CAP[activity.type]
  const counts: Partial<Record<Activity['type'], number>> = {
    song: day.songs,
    petted: day.pets,
    water: day.water,
    visit: day.visits
  }
  const count = counts[activity.type] ?? 0
  if (cap === undefined || count <= cap) next.xp += XP[activity.type]
  const yesterday = next.days[dayKey(now - 24 * 60 * 60_000)]
  if (!wasActiveToday && isActive(day) && isActive(yesterday)) next.xp += STREAK_XP
  if (levelOf(next.xp) > before) milestones.push({ type: 'level_up', level: levelOf(next.xp) })

  if (studyDay) {
    const days = focusStreak(next, now)
    if (STREAK_MILESTONES.has(days)) milestones.push({ type: 'streak', days })
  }

  for (const { item, done } of UNLOCKS) {
    if (!next.unlocked.includes(item) && done(next, now)) {
      next.unlocked.push(item)
      next.wearing.push(item) // put it on right away; can be taken off in the profile
      milestones.push({ type: 'unlocked', item })
    }
  }

  // forget old days
  const keys = Object.keys(next.days).sort()
  for (const old of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete next.days[old]

  return { progress: next, milestones }
}

// ---------- recap cards ----------

export interface Recap {
  title: string // "Today" / "This week"
  petName: string
  level: number
  tasks: number
  approvals: number
  filesEdited: number
  rainbows: number
  favoriteFile?: string
  busiestDay?: string // weekly only, e.g. "Tuesday"
  busiestHour?: number
  scariestMoment?: RiskyMoment
  streak: number
  songs: number
  pomodoros: number
  pets: number
  fish: number
  /** days with any activity in the period */
  daysTogether: number
}

function mergeDays(days: DayStats[]): DayStats {
  const total = emptyDay()
  for (const d of days) {
    total.tasks += d.tasks
    total.rainbows += d.rainbows ?? d.tasks
    total.approvals += d.approvals
    total.tools += d.tools
    total.rare += d.rare
    total.songs += d.songs ?? 0
    total.pomodoros += d.pomodoros ?? 0
    total.pets += d.pets ?? 0
    total.fish += d.fish ?? d.tasks
    total.risky.push(...d.risky)
    d.hours.forEach((n, h) => (total.hours[h] += n))
    for (const [file, n] of Object.entries(d.files))
      total.files[file] = (total.files[file] ?? 0) + n
  }
  return total
}

function topKey(counts: Record<string, number>): string | undefined {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
}

/** The numbers for today's card, or the last 7 days' "Wrapped". */
export function recap(progress: Progress, period: 'day' | 'week', now: number): Recap {
  const keys =
    period === 'day' ? [dayKey(now)] : Array.from({ length: 7 }, (_, i) => dayKey(now - i * 864e5))
  const perDay = keys.map((k) => progress.days[k] ?? emptyDay())
  const total = mergeDays(perDay)

  let busiestDay: string | undefined
  if (period === 'week') {
    const best = perDay.reduce(
      (bi, d, i) => (d.tasks + d.tools > perDay[bi].tasks + perDay[bi].tools ? i : bi),
      0
    )
    if (perDay[best].tasks + perDay[best].tools > 0) {
      busiestDay = new Date(now - best * 864e5).toLocaleDateString('en-US', { weekday: 'long' })
    }
  }
  const busiest = total.hours.indexOf(Math.max(...total.hours))

  return {
    title: period === 'day' ? 'Today' : 'This week',
    petName: progress.petName,
    level: levelOf(progress.xp),
    tasks: total.tasks,
    approvals: total.approvals,
    filesEdited: Object.keys(total.files).length,
    rainbows: total.rainbows,
    favoriteFile: topKey(total.files),
    busiestDay,
    busiestHour: total.tools > 0 ? busiest : undefined,
    // the scariest moment: the latest one at night if there is one, else the latest
    scariestMoment:
      total.risky.filter((r) => new Date(r.at).getHours() < 6).at(-1) ?? total.risky.at(-1),
    streak: streak(progress, now),
    songs: total.songs,
    pomodoros: total.pomodoros,
    pets: total.pets,
    fish: total.fish,
    daysTogether: perDay.filter(isActive).length
  }
}

/** Text for "Share to X". `fun` = no agent wording (Fun & focus mode). */
export function shareText(r: Recap, fun = false): string {
  if (fun) {
    const s = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`
    return `${r.title} with ${r.petName}: ${s(r.pomodoros, 'focus session')} 🍅, ${s(
      r.songs,
      'song'
    )} vibed 🎵, ${s(r.fish, 'fish')} fed 🐟. #AgentPet`
  }
  const parts = [
    `${r.title} my AI agent finished ${r.tasks} task${r.tasks === 1 ? '' : 's'}`,
    `I approved ${r.approvals} time${r.approvals === 1 ? '' : 's'}`,
    `${r.petName} farted ${r.rainbows} rainbow${r.rainbows === 1 ? '' : 's'} 🌈`
  ]
  return `${parts.join(', ')}. #AgentPet`
}

// ---------- time of day ----------

export type TimeMood = 'late_night' | 'morning' | 'friday' | null

/** Late night (0–5h), morning (6–9h); Fridays get a party hat all day. */
export function timeMood(now: number): { greeting: TimeMood; partyHat: boolean } {
  const d = new Date(now)
  const hour = d.getHours()
  const greeting: TimeMood = hour < 5 ? 'late_night' : hour >= 6 && hour < 10 ? 'morning' : null
  return { greeting, partyHat: d.getDay() === 5 }
}

/** What the renderer needs to draw the pet. */
export interface PetLook {
  petName: string
  level: number
  levelProgress: number
  stage: Stage
  wearing: Accessory[]
  hungry: boolean
  /** days in a row with a Pomodoro (scarf from SCARF_STREAK) */
  focusStreak: number
}

export function lookOf(progress: Progress, now: number): PetLook {
  const level = levelOf(progress.xp)
  return {
    petName: progress.petName,
    level,
    levelProgress: levelProgress(progress.xp),
    stage: stageOf(level),
    wearing: progress.wearing.filter((a) => progress.unlocked.includes(a)),
    hungry: isHungry(progress, now),
    focusStreak: focusStreak(progress, now)
  }
}
