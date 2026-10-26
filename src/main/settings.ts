// The settings store (settings.json in the app's data folder) and the one way to change it:
// updateSettings(). Modules that need to react (music, updater, window size…) subscribe with
// onSettingsChange() instead of being called from here.
import { BrowserWindow, app, ipcMain } from 'electron'
import Store from 'electron-store'
import { IPC } from '../shared/ipc'
import {
  type PetSettings,
  type SettingsChange,
  type StoredSettings,
  applyChange,
  cleanChange,
  withDefaults
} from '../shared/settings'

export interface Position {
  x: number
  y: number
}

/** Bookkeeping that isn't a user setting. */
interface Meta {
  windowPosition?: Position
  /** the first-run "Connect Claude Code" window was shown once (before 0.4.1) */
  connectPromptShown: boolean
  /** the first-run Welcome window was shown once */
  setupShown: boolean
  /** the "change anything later in Settings" bubble was shown once */
  settingsHintShown: boolean
}

// user settings live at the top level, next to the bookkeeping (as in older versions)
export const settings = new Store<Meta & Partial<StoredSettings>>({
  name: 'settings',
  defaults: { connectPromptShown: false, setupShown: false, settingsHintShown: false }
})

export const MUSIC_SUPPORTED = process.platform === 'win32'
export const AUTO_HIDE_SUPPORTED = process.platform === 'win32'

// Not saved: the demo is for showing the pet off right now. AGENTPET_DEMO=1 starts it on launch.
let demo = process.env['AGENTPET_DEMO'] === '1'

type Listener = (now: PetSettings, before: PetSettings) => void
const listeners: Listener[] = []

/** Runs after every change, with the settings before and after. */
export function onSettingsChange(listener: Listener): void {
  listeners.push(listener)
}

/** The saved settings; anything an older file lacks gets its default. */
export function storedSettings(): StoredSettings {
  return withDefaults(settings.store)
}

export function petSettings(): PetSettings {
  const stored = storedSettings()
  return {
    ...stored,
    music: stored.music && MUSIC_SUPPORTED,
    musicSupported: MUSIC_SUPPORTED,
    autoHideSupported: AUTO_HIDE_SUPPORTED,
    demo,
    startOnLogin: app.isPackaged && app.getLoginItemSettings().openAtLogin,
    startOnLoginSupported: app.isPackaged
  }
}

/** Saves a change (validated) and tells every window and listener about it. */
export function updateSettings(input: SettingsChange & { demo?: boolean }): void {
  const before = petSettings()
  const change = cleanChange(input)
  settings.set(applyChange(storedSettings(), change))
  if (typeof input.demo === 'boolean') demo = input.demo
  if (change.startOnLogin !== undefined && app.isPackaged)
    app.setLoginItemSettings({ openAtLogin: change.startOnLogin })
  const now = petSettings()
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.settings, now)
  for (const listener of listeners) listener(now, before)
}

/** Back to the defaults for everything except the pet's look and the mode. */
export function resetSettings(): void {
  const { skin, size, mode } = storedSettings()
  settings.set({ ...withDefaults({}), skin, size, mode })
  updateSettings({})
}

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC.getSettings, () => petSettings())
  ipcMain.on(IPC.setMusic, (_, on: unknown) => {
    if (typeof on === 'boolean') updateSettings({ music: on })
  })
  ipcMain.on(IPC.changeSettings, (_, change: unknown) => updateSettings(cleanChange(change)))
  ipcMain.on(IPC.setDemo, (_, on: unknown) => {
    if (typeof on === 'boolean') updateSettings({ demo: on })
  })
}
