// Laser game: Ctrl+Alt+L puts a red dot under the mouse and he chases it around the screen.
// Esc, the shortcut again, or 30 seconds ends it, and he trots back to where he was.
import { BrowserWindow, app, globalShortcut, screen } from 'electron'
import { IPC, type WalkState } from '../shared/ipc'
import { dailyState, setDaily } from './daily'
import { recordActivity, sendMoment } from './progress'
import { onSettingsChange, storedSettings } from './settings'
import { chaseStep, endChase } from './window'

const SHORTCUT = 'CommandOrControl+Alt+L'
const GAME_MS = 30_000
const TICK_MS = 30
const DOT = 18
/** a catch counts once per this long (he sits on the dot otherwise) */
const CATCH_EVERY_MS = 2500

// a pixel-art red dot with a glow, as a tiny page
const DOT_PAGE = `data:text/html,${encodeURIComponent(
  `<html><body style="margin:0;background:transparent;overflow:hidden">
  <div style="position:absolute;left:3px;top:3px;width:12px;height:12px;background:#ff2a2a;
  box-shadow:0 0 0 3px rgba(255,42,42,.35);image-rendering:pixelated"></div></body></html>`
)}`

let dot: BrowserWindow | null = null
let timer: NodeJS.Timeout | undefined
let endTimer: NodeJS.Timeout | undefined
let lastCatch = 0
let lastX = 0

function tellWalk(walk: WalkState): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.walk, walk)
}

function start(): void {
  if (dot || !storedSettings().laser) return
  dot = new BrowserWindow({
    width: DOT,
    height: DOT,
    transparent: true,
    frame: false,
    resizable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true }
  })
  dot.setAlwaysOnTop(true, 'screen-saver')
  dot.setIgnoreMouseEvents(true)
  void dot.loadURL(DOT_PAGE)
  dot.once('ready-to-show', () => dot?.showInactive())
  setDaily({ laser: true })
  globalShortcut.register('Escape', stop)

  timer = setInterval(() => {
    const p = screen.getCursorScreenPoint()
    dot?.setBounds({ x: p.x - DOT / 2, y: p.y - DOT / 2, width: DOT, height: DOT })
    const caught = chaseStep(p)
    tellWalk({ walking: !caught, facing: p.x < lastX ? 'left' : 'right' })
    lastX = p.x
    if (caught && Date.now() - lastCatch > CATCH_EVERY_MS) {
      lastCatch = Date.now()
      recordActivity({ type: 'petted' })
      sendMoment({ kind: 'caught' })
    }
  }, TICK_MS)
  endTimer = setTimeout(stop, GAME_MS)
}

function stop(): void {
  clearInterval(timer)
  clearTimeout(endTimer)
  globalShortcut.unregister('Escape')
  dot?.destroy()
  dot = null
  if (dailyState().laser) {
    setDaily({ laser: false })
    tellWalk({ walking: false, facing: 'right' })
    endChase()
  }
}

function register(): void {
  globalShortcut.unregister(SHORTCUT)
  if (storedSettings().laser) globalShortcut.register(SHORTCUT, () => (dot ? stop() : start()))
  else stop()
}

export function startLaser(): void {
  register()
  onSettingsChange((now, before) => {
    if (now.laser !== before.laser) register()
  })
  app.on('will-quit', () => {
    stop()
    globalShortcut.unregisterAll()
  })
}
