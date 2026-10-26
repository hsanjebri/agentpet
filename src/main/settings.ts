import { BrowserWindow, app, ipcMain } from 'electron'
import Store from 'electron-store'
import { IPC, type PetSettings, type SettingsChange } from '../shared/ipc'
import { DEFAULT_SKIN, SKINS, type SkinId, usableSkin } from '../shared/skins'
import { MUSIC_SUPPORTED, setMusicEnabled } from './music'

export interface Position {
  x: number
  y: number
}

interface Settings {
  windowPosition?: Position
  skin: SkinId
  muted: boolean
  focusMode: boolean
  wander: boolean
  music: boolean
  /** the first-run "Connect Claude Code" window was shown once (before 0.4.1) */
  connectPromptShown: boolean
  /** the first-run Welcome window was shown once */
  setupShown: boolean
}

export const settings = new Store<Settings>({
  name: 'settings',
  defaults: {
    skin: DEFAULT_SKIN,
    muted: false,
    focusMode: false,
    wander: true,
    music: true,
    connectPromptShown: false,
    setupShown: false
  }
})

// Not saved: the demo is for showing the pet off right now. AGENTPET_DEMO=1 starts it on launch.
let demo = process.env['AGENTPET_DEMO'] === '1'

export function petSettings(): PetSettings {
  return {
    skin: usableSkin(settings.get('skin')),
    muted: settings.get('muted'),
    focusMode: settings.get('focusMode'),
    wander: settings.get('wander'),
    music: settings.get('music') && MUSIC_SUPPORTED,
    musicSupported: MUSIC_SUPPORTED,
    demo,
    startOnLogin: app.isPackaged && app.getLoginItemSettings().openAtLogin,
    startOnLoginSupported: app.isPackaged
  }
}

/** Saves a change and tells every pet window about it. */
export function updateSettings(change: Partial<PetSettings>): void {
  if (change.skin !== undefined) settings.set('skin', change.skin)
  if (change.muted !== undefined) settings.set('muted', change.muted)
  if (change.focusMode !== undefined) settings.set('focusMode', change.focusMode)
  if (change.wander !== undefined) settings.set('wander', change.wander)
  if (change.music !== undefined) {
    settings.set('music', change.music)
    setMusicEnabled(change.music)
  }
  if (change.demo !== undefined) demo = change.demo
  if (change.startOnLogin !== undefined && app.isPackaged)
    app.setLoginItemSettings({ openAtLogin: change.startOnLogin })
  const current = petSettings()
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.settings, current)
}

export function registerSettingsIpc(onChange: () => void): void {
  ipcMain.handle(IPC.getSettings, () => petSettings())
  ipcMain.on(IPC.setMusic, (_, on: unknown) => {
    if (typeof on !== 'boolean') return
    updateSettings({ music: on })
    onChange()
  })
  // the Welcome window: only these few settings, checked one by one
  ipcMain.on(IPC.changeSettings, (_, change: SettingsChange) => {
    if (typeof change !== 'object' || change === null) return
    const clean: SettingsChange = {}
    if (SKINS.some((s) => s.ready && s.id === change.skin)) clean.skin = change.skin
    if (typeof change.music === 'boolean') clean.music = change.music
    if (typeof change.startOnLogin === 'boolean') clean.startOnLogin = change.startOnLogin
    updateSettings(clean)
    onChange()
  })
}
