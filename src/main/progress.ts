// Keeps the pet's progress (stats, XP, unlocks, name) on disk and tells the windows about it.
import { BrowserWindow, ClipboardItem, clipboard, dialog, ipcMain, shell } from 'electron'
import { writeFileSync } from 'fs'
import Store from 'electron-store'
import { IPC, type PetMoment, type ProfileData } from '../shared/ipc'
import { onSettingsChange, storedSettings } from './settings'
import {
  type Accessory,
  type Activity,
  DEFAULT_NAME,
  FUN_UNLOCK_LABELS,
  type PetLook,
  type Progress,
  UNLOCKS,
  dayKey,
  emptyProgress,
  levelOf,
  lookOf,
  recap,
  record,
  streak
} from '../shared/progress'

const store = new Store<{ progress: Progress }>({
  name: 'progress',
  defaults: { progress: emptyProgress() }
})

// older files may miss newer fields
let progress: Progress = { ...emptyProgress(), ...store.get('progress') }
let saveTimer: NodeJS.Timeout | undefined

/** What the pet looks like now; no hunger when feeding is off. */
function look(): PetLook {
  const l = lookOf(progress, Date.now())
  return storedSettings().feeding ? l : { ...l, hungry: false }
}

function broadcast(channel: string, value: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, value)
}

/** Tool calls are frequent: write to disk at most every couple of seconds. */
function save(): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => store.set('progress', progress), 2000)
}

export function flushProgress(): void {
  clearTimeout(saveTimer)
  store.set('progress', progress)
}

function update(next: Progress): void {
  const looked = JSON.stringify(look())
  progress = next
  save()
  const now = look()
  if (JSON.stringify(now) !== looked) broadcast(IPC.look, now)
}

// feeding switched on / off: hunger shows or goes
onSettingsChange((now, before) => {
  if (now.feeding !== before.feeding) broadcast(IPC.look, look())
})

export function recordActivity(activity: Activity): void {
  const { progress: next, milestones } = record(progress, activity, Date.now())
  update(next)
  for (const m of milestones) {
    const moment: PetMoment =
      m.type === 'level_up'
        ? { kind: 'level_up', level: m.level }
        : m.type === 'streak'
          ? { kind: 'streak', days: m.days }
          : { kind: 'unlocked', item: m.item }
    broadcast(IPC.moment, moment)
  }
}

/** Settings › Privacy: forget daily stats and totals; level, accessories and name stay. */
export function resetStats(): void {
  const fresh = emptyProgress()
  update({
    ...progress,
    totalTasks: 0,
    totalApprovals: 0,
    totalRainbows: 0,
    lastFedAt: null,
    days: fresh.days
  })
  flushProgress()
}

/** Settings › Privacy: a brand-new kitten (keeps only the name). */
export function resetProgress(): void {
  update({ ...emptyProgress(), petName: progress.petName })
  flushProgress()
}

export function sendMoment(moment: PetMoment): void {
  broadcast(IPC.moment, moment)
}

export function pomodorosToday(): number {
  return progress.days[dayKey(Date.now())]?.pomodoros ?? 0
}

export function petLevel(): number {
  return levelOf(progress.xp)
}

export function petName(): string {
  return progress.petName
}

function profile(): ProfileData {
  const now = Date.now()
  return {
    look: look(),
    totals: {
      tasks: progress.totalTasks,
      approvals: progress.totalApprovals,
      rainbows: progress.totalRainbows,
      pomodoros: progress.totalPomodoros ?? 0
    },
    streak: streak(progress, now),
    unlocks: UNLOCKS.map(({ item, label }) => ({
      item,
      // Fun & focus mode: no agent wording
      label: storedSettings().mode === 'fun' ? FUN_UNLOCK_LABELS[item] : label,
      unlocked: progress.unlocked.includes(item)
    })),
    today: recap(progress, 'day', now),
    week: recap(progress, 'week', now),
    lastFedAt: progress.lastFedAt
  }
}

const ACCESSORIES: readonly Accessory[] = ['tophat', 'sunglasses', 'crown']

function pngFromDataUrl(dataUrl: unknown): Buffer | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) return null
  return Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64')
}

/** `onNameChange` lets the tray relabel itself. */
export function registerProgressIpc(onNameChange: () => void): void {
  ipcMain.handle(IPC.getLook, () => look())
  ipcMain.handle(IPC.getProfile, () => profile())

  ipcMain.on(IPC.petted, () => recordActivity({ type: 'petted' }))

  ipcMain.on(IPC.setPetName, (_, name: unknown) => {
    if (typeof name !== 'string') return
    const clean = name.trim().slice(0, 24) || DEFAULT_NAME
    update({ ...progress, petName: clean })
    onNameChange()
  })

  ipcMain.on(IPC.setWearing, (_, items: unknown) => {
    if (!Array.isArray(items)) return
    const wearing = ACCESSORIES.filter((a) => items.includes(a) && progress.unlocked.includes(a))
    update({ ...progress, wearing })
  })

  ipcMain.handle(IPC.saveCard, async (e, dataUrl: unknown, fileName: unknown) => {
    const png = pngFromDataUrl(dataUrl)
    if (!png) return null
    const win = BrowserWindow.fromWebContents(e.sender)
    const options = {
      defaultPath: typeof fileName === 'string' ? fileName : 'agentpet.png',
      filters: [{ name: 'PNG image', extensions: ['png'] }]
    }
    const { canceled, filePath } = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    if (canceled || !filePath) return null
    writeFileSync(filePath, png)
    return filePath
  })

  ipcMain.on(IPC.copyCard, (_, dataUrl: unknown) => {
    const png = pngFromDataUrl(dataUrl)
    if (png) {
      const image = new Blob([new Uint8Array(png)], { type: 'image/png' })
      clipboard.write([new ClipboardItem({ 'image/png': image })]).catch(() => {})
    }
  })

  ipcMain.on(IPC.share, (_, text: unknown) => {
    if (typeof text !== 'string') return
    shell.openExternal(`https://x.com/intent/post?text=${encodeURIComponent(text.slice(0, 280))}`)
  })
}
