// Visits. Sending: your cat walks off your screen and spends a few minutes on a friend's desktop,
// then comes home. Hosting: a friend's cat walks in next to yours (its own little window) and
// leaves after a while, or when you tap "Bye". Only between accepted friends, only if the host
// accepts visits, never during a focus round or bedtime. Carries only name, skin and level.
import { randomUUID } from 'crypto'
import { BrowserWindow, app, ipcMain, screen } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import { IPC } from '../shared/ipc'
import {
  ANSWER_MS,
  type Guest,
  VISIT_MS,
  type VisitMessage,
  parseVisitMessage,
  refusal,
  refusalText
} from '../shared/visits'
import { dailyState } from './daily'
import { friendsService } from './friends'
import { inFocusRound } from './pomodoro'
import { petLevel, petName, recordActivity, sendMoment } from './progress'
import { storedSettings } from './settings'
import { comeBackFromVisit, isAutoHidden, leaveForVisit, petBounds } from './window'

// ---------- sending your cat ----------

let away: { visitId: string; to: string; name: string; timer?: NodeJS.Timeout } | null = null

export function isAway(): boolean {
  return away !== null
}

function toast(text: string): void {
  sendMoment({ kind: 'visit', text })
}

/** Right-click › Visit a friend, or Settings › Friends › Visit. */
export async function visitFriend(userId: string): Promise<string> {
  const service = friendsService()
  const friend = service.current().friends.find((f) => f.userId === userId)
  if (!friend) return 'Not a friend.'
  if (!friend.online) return `${friend.name} isn't online right now.`
  if (away) return `${petName()} is already visiting ${away.name}.`
  if (hosting) return `Wait until ${hosting.guest.name} goes home.`
  const me = service.myId()
  if (!me) return 'Friends is offline.'

  const visitId = randomUUID()
  away = { visitId, to: userId, name: friend.name }
  const sent = await service.sendTo(userId, 'visit', {
    visitId,
    from: me,
    name: petName(),
    skin: storedSettings().skin,
    level: petLevel()
  })
  if (!sent) {
    away = null
    return `Couldn't reach ${friend.name}. Try again in a moment.`
  }
  // no answer: their app may be closing or asleep
  away.timer = setTimeout(() => {
    if (away?.visitId !== visitId || awayStarted) return
    away = null
    toast(`${friend.name} didn't answer. Maybe later!`)
  }, ANSWER_MS)
  return `Knocking on ${friend.name}'s door…`
}

let awayStarted = false

function startAway(): void {
  if (!away) return
  clearTimeout(away.timer)
  awayStarted = true
  toast(`off to visit ${away.name} 🧳`)
  leaveForVisit()
  const { visitId } = away
  // the host ends it too, but don't stay away forever if their app vanishes
  away.timer = setTimeout(() => endAway(visitId), VISIT_MS + 15_000)
}

function endAway(visitId: string): void {
  if (!away || away.visitId !== visitId) return
  const { name } = away
  clearTimeout(away.timer)
  away = null
  awayStarted = false
  comeBackFromVisit()
  recordActivity({ type: 'visit' })
  setTimeout(() => toast(`back from ${name}'s 🐟 ${name} says hi!`), 1200)
}

// ---------- hosting a guest ----------

let hosting: { guest: Guest; win: BrowserWindow; timer: NodeJS.Timeout } | null = null

function guestWindow(): BrowserWindow {
  const pet = petBounds()
  const { workArea } = screen.getDisplayMatching(pet)
  const win = new BrowserWindow({
    x: workArea.x - pet.width, // walks in from the left edge
    y: pet.y,
    width: pet.width,
    height: pet.height,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true, { forward: true })
  if (is.dev && process.env['ELECTRON_RENDERER_URL'])
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#guest`)
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'guest' })
  win.once('ready-to-show', () => {
    win.showInactive()
    // walk in and sit down next to our cat (on whichever side has room)
    const target = Math.max(workArea.x, pet.x - pet.width * 0.62)
    glide(win, target, 1800)
  })
  return win
}

/** Moves a window horizontally over `ms` (eased), then calls `done`. */
function glide(win: BrowserWindow, toX: number, ms: number, done?: () => void): void {
  const [fromX, y] = win.getPosition()
  const started = Date.now()
  const timer = setInterval(() => {
    if (win.isDestroyed()) return clearInterval(timer)
    const t = Math.min(1, (Date.now() - started) / ms)
    const ease = 1 - (1 - t) ** 2
    win.setPosition(Math.round(fromX + (toX - fromX) * ease), y)
    if (t === 1) {
      clearInterval(timer)
      done?.()
    }
  }, 16)
}

function host(guest: Guest): void {
  const win = guestWindow()
  const timer = setTimeout(() => endHosting('guest'), VISIT_MS)
  hosting = { guest, win, timer }
  setTimeout(() => toast(`${guest.name} is here! 👋`), 1600)
}

/** The guest leaves (time is up, or "Bye"), and its owner's app is told. */
function endHosting(by: 'host' | 'guest'): void {
  if (!hosting) return
  const { guest, win, timer } = hosting
  hosting = null
  clearTimeout(timer)
  void friendsService().sendTo(guest.from, 'visit_end', { visitId: guest.visitId, by })
  recordActivity({ type: 'visit' })
  if (!win.isDestroyed()) {
    const { workArea } = screen.getDisplayMatching(win.getBounds())
    glide(win, workArea.x - win.getBounds().width, 1500, () => win.destroy())
  }
  setTimeout(() => toast(`${guest.name} went home 👋`), 1400)
}

// ---------- messages ----------

function onMessage(event: string, payload: unknown): void {
  const msg: VisitMessage | null = parseVisitMessage(event, payload)
  if (!msg) return
  const service = friendsService()
  switch (msg.type) {
    case 'visit': {
      const daily = dailyState()
      const no = refusal({
        accepts: storedSettings().visits,
        hosting: hosting !== null,
        away: away !== null,
        focusRound: inFocusRound(),
        bedtime: daily.bedtime !== null,
        hidden: isAutoHidden(),
        isFriend: service.isFriend(msg.from)
      })
      if (no) {
        void service.sendTo(msg.from, 'visit_no', { visitId: msg.visitId, reason: no })
        return
      }
      void service.sendTo(msg.from, 'visit_ok', { visitId: msg.visitId })
      host(msg)
      return
    }
    case 'visit_ok':
      if (away?.visitId === msg.visitId && !awayStarted) startAway()
      return
    case 'visit_no':
      if (away?.visitId === msg.visitId && !awayStarted) {
        clearTimeout(away.timer)
        toast(refusalText(away.name, msg.reason))
        away = null
      }
      return
    case 'visit_end':
      // our cat's visit is over / our guest's owner called it home
      if (away?.visitId === msg.visitId) endAway(msg.visitId)
      else if (hosting?.guest.visitId === msg.visitId) endHosting('guest')
      return
  }
}

export function startVisits(): void {
  friendsService().setMessageHandler(onMessage)
  ipcMain.handle(IPC.visitFriend, (_, userId: unknown) =>
    typeof userId === 'string' ? visitFriend(userId) : 'Not a friend.'
  )
  ipcMain.handle(IPC.getGuest, () => hosting?.guest ?? null)
  ipcMain.on(IPC.guestBye, () => endHosting('host'))
  ipcMain.on(IPC.guestInteractive, (e, on: unknown) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win && hosting?.win === win && typeof on === 'boolean')
      win.setIgnoreMouseEvents(!on, { forward: true })
  })
  app.on('before-quit', () => {
    if (hosting) endHosting('host')
    if (away)
      void friendsService().sendTo(away.to, 'visit_end', { visitId: away.visitId, by: 'guest' })
  })
}
