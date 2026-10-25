// Now and then, when the agent has been quiet for a while, the pet takes a stroll along the
// bottom of the screen, sits for a bit, and walks back home.
import { type BrowserWindow, screen } from 'electron'
import { IPC, type WalkState } from '../shared/ipc'
import { WINDOW_WIDTH, cancelWalk, glideTo, isAlerting, walkTo } from './window'

const CHECK_MS = 60_000
const QUIET_MS = 5 * 60_000 // only after 5 minutes without agent activity
const CHANCE = 0.15 // per check: a stroll every ~7 minutes on average
const SPEED = 70 // px per second, a lazy cat walk
const SIT_MS = 8000
const MIN_DISTANCE = 220

interface Options {
  enabled(): boolean
  lastActivity(): number
}

let pet: BrowserWindow | null = null
let strolling = false
let home: { x: number; y: number } | null = null
let sitTimer: NodeJS.Timeout | undefined

function tell(win: BrowserWindow, walk: WalkState): void {
  if (!win.isDestroyed()) win.webContents.send(IPC.walk, walk)
}

function finish(win: BrowserWindow): void {
  strolling = false
  home = null
  tell(win, { walking: false, facing: 'right' })
}

function stroll(win: BrowserWindow): void {
  const [x, y] = win.getPosition()
  const { workArea: a } = screen.getDisplayMatching(win.getBounds())
  const left = a.x
  const right = a.x + a.width - WINDOW_WIDTH
  // pick a spot far enough away, on whichever side has room
  const target =
    x - left > right - x
      ? left + Math.random() * Math.max(0, x - left - MIN_DISTANCE)
      : x + MIN_DISTANCE + Math.random() * Math.max(0, right - x - MIN_DISTANCE)
  if (Math.abs(target - x) < MIN_DISTANCE / 2) return

  strolling = true
  home = { x, y }
  const back = home
  const cancelled = (): void => finish(win) // dragged or alerted: stay where the user put him

  tell(win, { walking: true, facing: target < x ? 'left' : 'right' })
  walkTo(
    win,
    target,
    SPEED,
    () => {
      tell(win, { walking: false, facing: target < x ? 'left' : 'right' })
      sitTimer = setTimeout(() => {
        // moved while sitting: the user put him somewhere new, so he stays there
        if (Math.abs(win.getPosition()[0] - target) > 2) return finish(win)
        tell(win, { walking: true, facing: back.x < target ? 'left' : 'right' })
        walkTo(win, back.x, SPEED, () => finish(win), cancelled)
      }, SIT_MS)
    },
    cancelled
  )
}

/** The agent woke up: hurry back home. */
export function interruptWander(): void {
  const win = pet
  if (!strolling || !win || win.isDestroyed()) return
  clearTimeout(sitTimer)
  const back = home
  cancelWalk()
  if (back) glideTo(win, back)
  finish(win)
}

export function startWander(win: BrowserWindow, options: Options): void {
  pet = win
  const timer = setInterval(() => {
    if (win.isDestroyed()) return clearInterval(timer)
    if (strolling || !options.enabled() || isAlerting()) return
    if (Date.now() - options.lastActivity() < QUIET_MS) return
    if (Math.random() < CHANCE) stroll(win)
  }, CHECK_MS)
}
