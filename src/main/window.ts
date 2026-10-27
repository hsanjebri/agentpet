// The pet's transparent overlay window: positioning, click-through and dragging.
import { BrowserWindow, ipcMain, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC, type DragResult } from '../shared/ipc'
import { SIZE_SCALE } from '../shared/settings'
import { type Position, onSettingsChange, settings, storedSettings } from './settings'

// Noodle is 88×46 cells (at 4 px: 352×184); above him sit the approval bubble and demo label,
// below him the usage bar. Size S/M/L draws him at 3/4/5 px per cell.
const SPRITE_W = 90
const SPRITE_H = 46
/** room above and below the sprite for bubbles and the usage bar */
const EXTRA_H = 156
/** bubbles need this much width even when the pet is small */
const MIN_W = 330

export function windowSize(): { width: number; height: number } {
  const scale = SIZE_SCALE[storedSettings().size]
  return { width: Math.max(SPRITE_W * scale, MIN_W), height: SPRITE_H * scale + EXTRA_H }
}
const SCREEN_MARGIN = 16
const CLICK_TOLERANCE = 4 // px the pointer may move before a press counts as a drag

function isOnSomeDisplay({ x, y }: Position): boolean {
  const center = { x: x + windowSize().width / 2, y: y + windowSize().height / 2 }
  return screen.getAllDisplays().some(({ workArea: a }) => {
    return (
      center.x >= a.x && center.x < a.x + a.width && center.y >= a.y && center.y < a.y + a.height
    )
  })
}

/** Bottom-right corner of the primary display's work area (above the taskbar / dock). */
export function homePosition(): Position {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: workArea.x + workArea.width - windowSize().width - SCREEN_MARGIN,
    y: workArea.y + workArea.height - windowSize().height
  }
}

/** Keeps the whole window inside the work area of the display it is on. */
function clampToDisplay({ x, y }: Position): Position {
  const { workArea: a } = screen.getDisplayMatching({
    x,
    y,
    width: windowSize().width,
    height: windowSize().height
  })
  return {
    x: Math.min(Math.max(x, a.x), a.x + a.width - windowSize().width),
    y: Math.min(Math.max(y, a.y), a.y + a.height - windowSize().height)
  }
}

function startPosition(): Position {
  const saved = settings.get('windowPosition')
  return saved && isOnSomeDisplay(saved) ? clampToDisplay(saved) : homePosition()
}

export function createPetWindow(): BrowserWindow {
  const { x, y } = startPosition()
  const win = new BrowserWindow({
    x,
    y,
    width: windowSize().width,
    height: windowSize().height,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false, // never steal focus from the terminal / IDE
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required' // the meow must play without a click
    }
  })

  // 'screen-saver' keeps the pet above full-screen windows where the OS allows it.
  win.setAlwaysOnTop(true, 'screen-saver')
  if (process.platform !== 'win32') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
  // Click-through by default; forward mouse moves so the renderer can detect hovering the pet.
  win.setIgnoreMouseEvents(true, { forward: true })

  win.once('ready-to-show', () => {
    // Windows can create a transparent frameless window a few px too big at fractional
    // scaling; re-applying the bounds fixes it before the pet appears.
    moveWindow(win, { x, y })
    shown = true
    if (!autoHidden) win.showInactive()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  registerPointerIpc(win)
  pet = win

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

let pet: BrowserWindow | null = null
let shown = false // first shown (ready-to-show)
let autoHidden = false

/** Auto-hide: out of sight during a fullscreen app, a meeting or Do not disturb. */
export function setAutoHidden(hidden: boolean): void {
  if (hidden === autoHidden) return
  autoHidden = hidden
  if (!pet || pet.isDestroyed() || !shown) return
  if (hidden) pet.hide()
  else pet.showInactive()
}

// size S/M/L changed: resize, keeping his feet where they were (bottom center)
onSettingsChange((now, before) => {
  if (now.size === before.size || !pet || pet.isDestroyed()) return
  const old = pet.getBounds()
  const { width, height } = windowSize()
  const next = clampToDisplay({
    x: old.x + (old.width - width) / 2,
    y: old.y + old.height - height
  })
  moveWindow(pet, next)
  settings.set('windowPosition', next)
})

/** Back to the bottom-right corner (Settings › General). */
export function resetPetPosition(): void {
  settings.delete('windowPosition')
  if (pet && !pet.isDestroyed()) moveWindow(pet, homePosition())
}

/** Moves the window keeping its size fixed (setPosition can resize it on mixed-DPI setups). */
export function moveWindow(win: BrowserWindow, { x, y }: Position): void {
  win.setBounds({
    x: Math.round(x),
    y: Math.round(y),
    width: windowSize().width,
    height: windowSize().height
  })
}

// ---------- needs-you alert: hop a bit toward the middle of the screen, then back ----------

const ALERT_PULL = 0.25 // how far toward the screen center (fraction of the way)
const GLIDE_MS = 260
/** Where the pet was before the alert moved it, while the alert is on. */
let restPosition: Position | null = null
let glideTimer: NodeJS.Timeout | undefined

export function glideTo(win: BrowserWindow, target: Position): void {
  clearInterval(glideTimer)
  const [fromX, fromY] = win.getPosition()
  const started = Date.now()
  glideTimer = setInterval(() => {
    const t = Math.min(1, (Date.now() - started) / GLIDE_MS)
    const ease = 1 - (1 - t) ** 3
    moveWindow(win, { x: fromX + (target.x - fromX) * ease, y: fromY + (target.y - fromY) * ease })
    if (t === 1) clearInterval(glideTimer)
  }, 16)
}

// ---------- distraction guard: sit on a window, then go back ----------

let guardRest: Position | null = null

/** Plops him in the middle of a window (DIP bounds). Remembers where he was. */
export function sitOnWindow(b: { x: number; y: number; width: number; height: number }): void {
  if (!pet || pet.isDestroyed()) return
  cancelWalk()
  if (!guardRest) {
    const [x, y] = pet.getPosition()
    guardRest = { x, y }
  }
  const { width, height } = windowSize()
  glideTo(pet, clampToDisplay({ x: b.x + (b.width - width) / 2, y: b.y + (b.height - height) / 2 }))
}

export function leaveWindow(): void {
  if (pet && !pet.isDestroyed() && guardRest) glideTo(pet, guardRest)
  guardRest = null
}

// ---------- laser: chase a point on screen ----------

let chaseRest: Position | null = null

/** One step toward `target` (the dot); returns true when he's right on it. */
export function chaseStep(target: Position, speed = 14): boolean {
  if (!pet || pet.isDestroyed()) return false
  const [x, y] = pet.getPosition()
  if (!chaseRest) chaseRest = { x, y }
  const { width, height } = windowSize()
  // aim his face (right side, lower half of the window) at the dot
  const goal = clampToDisplay({ x: target.x - width * 0.8, y: target.y - height * 0.72 })
  const dx = goal.x - x
  const dy = goal.y - y
  const dist = Math.hypot(dx, dy)
  if (dist < speed) {
    moveWindow(pet, goal)
    return true
  }
  moveWindow(pet, { x: x + (dx / dist) * speed, y: y + (dy / dist) * speed })
  return false
}

export function endChase(): void {
  if (pet && !pet.isDestroyed() && chaseRest) glideTo(pet, chaseRest)
  chaseRest = null
}

// ---------- walking (wander.ts decides when) ----------

let walkTimer: NodeJS.Timeout | undefined
let onWalkCancelled: (() => void) | undefined

/** Stops a walk in progress (drag, alert…). */
export function cancelWalk(): void {
  if (!walkTimer) return
  clearInterval(walkTimer)
  walkTimer = undefined
  const cancelled = onWalkCancelled
  onWalkCancelled = undefined
  cancelled?.()
}

/** Walks horizontally to `x` at a steady pace (px/s). */
export function walkTo(
  win: BrowserWindow,
  x: number,
  speed: number,
  onArrive: () => void,
  onCancel: () => void
): void {
  cancelWalk()
  const [fromX, y] = win.getPosition()
  const duration = (Math.abs(x - fromX) / speed) * 1000
  const started = Date.now()
  onWalkCancelled = onCancel
  walkTimer = setInterval(() => {
    if (win.isDestroyed()) return cancelWalk()
    const t = Math.min(1, (Date.now() - started) / duration)
    moveWindow(win, { x: fromX + (x - fromX) * t, y })
    if (t === 1) {
      clearInterval(walkTimer)
      walkTimer = undefined
      onWalkCancelled = undefined
      onArrive()
    }
  }, 16)
}

export function isAlerting(): boolean {
  return restPosition !== null
}

export function setAlert(win: BrowserWindow, on: boolean): void {
  if (win.isDestroyed()) return
  if (on) cancelWalk()
  if (on && !restPosition) {
    const [x, y] = win.getPosition()
    restPosition = { x, y }
    const { workArea: a } = screen.getDisplayMatching(win.getBounds())
    const center = {
      x: a.x + (a.width - windowSize().width) / 2,
      y: a.y + (a.height - windowSize().height) / 2
    }
    glideTo(
      win,
      clampToDisplay({
        x: x + (center.x - x) * ALERT_PULL,
        y: y + (center.y - y) * ALERT_PULL
      })
    )
  } else if (!on && restPosition) {
    glideTo(win, restPosition)
    restPosition = null
  }
}

function registerPointerIpc(win: BrowserWindow): void {
  const fromPet = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): boolean =>
    e.sender === win.webContents

  let dragTimer: NodeJS.Timeout | undefined
  let moved = false

  const stopDrag = (): void => {
    clearInterval(dragTimer)
    dragTimer = undefined
  }

  ipcMain.on(IPC.setInteractive, (e, interactive: unknown) => {
    if (!fromPet(e) || typeof interactive !== 'boolean') return
    win.setIgnoreMouseEvents(!interactive, { forward: true })
  })

  // While dragging, follow the cursor from the main process. That keeps working even
  // when the pointer moves faster than the window.
  ipcMain.on(IPC.dragStart, (e) => {
    if (!fromPet(e)) return
    stopDrag()
    clearInterval(glideTimer)
    cancelWalk()
    const start = screen.getCursorScreenPoint()
    const [wx, wy] = win.getPosition()
    const offset = { x: start.x - wx, y: start.y - wy }
    moved = false
    dragTimer = setInterval(() => {
      const cursor = screen.getCursorScreenPoint()
      if (!moved && Math.hypot(cursor.x - start.x, cursor.y - start.y) <= CLICK_TOLERANCE) return
      moved = true
      moveWindow(win, { x: cursor.x - offset.x, y: cursor.y - offset.y })
    }, 16)
  })

  ipcMain.handle(IPC.dragEnd, (e): DragResult => {
    if (!fromPet(e)) return { moved: false }
    stopDrag()
    if (moved) {
      const [x, y] = win.getPosition()
      settings.set('windowPosition', { x, y })
      restPosition = null // dropped somewhere new: that's home now, even during an alert
    }
    return { moved }
  })

  win.on('closed', () => {
    stopDrag()
    ipcMain.removeAllListeners(IPC.setInteractive)
    ipcMain.removeAllListeners(IPC.dragStart)
    ipcMain.removeHandler(IPC.dragEnd)
  })
}
