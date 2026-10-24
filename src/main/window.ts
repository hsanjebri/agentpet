// The pet's transparent overlay window: positioning, click-through and dragging.
import { BrowserWindow, ipcMain, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC, type DragResult } from '../shared/ipc'
import { type Position, settings } from './settings'

// Noodle is 90×48 cells at 4px (360×192); the extra height is room to hop and for the speech bubble.
export const WINDOW_WIDTH = 360
export const WINDOW_HEIGHT = 240
const SCREEN_MARGIN = 16
const CLICK_TOLERANCE = 4 // px the pointer may move before a press counts as a drag

function isOnSomeDisplay({ x, y }: Position): boolean {
  const center = { x: x + WINDOW_WIDTH / 2, y: y + WINDOW_HEIGHT / 2 }
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
    x: workArea.x + workArea.width - WINDOW_WIDTH - SCREEN_MARGIN,
    y: workArea.y + workArea.height - WINDOW_HEIGHT
  }
}

/** Keeps the whole window inside the work area of the display it is on. */
function clampToDisplay({ x, y }: Position): Position {
  const { workArea: a } = screen.getDisplayMatching({
    x,
    y,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT
  })
  return {
    x: Math.min(Math.max(x, a.x), a.x + a.width - WINDOW_WIDTH),
    y: Math.min(Math.max(y, a.y), a.y + a.height - WINDOW_HEIGHT)
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
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
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
      sandbox: true
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
    win.showInactive()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  registerPointerIpc(win)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

/** Moves the window keeping its size fixed (setPosition can resize it on mixed-DPI setups). */
export function moveWindow(win: BrowserWindow, { x, y }: Position): void {
  win.setBounds({ x: Math.round(x), y: Math.round(y), width: WINDOW_WIDTH, height: WINDOW_HEIGHT })
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
