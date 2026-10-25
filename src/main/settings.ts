import { BrowserWindow, ipcMain } from 'electron'
import Store from 'electron-store'
import { IPC, type PetSettings } from '../shared/ipc'
import { DEFAULT_SKIN, type SkinId, usableSkin } from '../shared/skins'

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
  /** the first-run "Connect Claude Code" window was shown once */
  connectPromptShown: boolean
}

export const settings = new Store<Settings>({
  name: 'settings',
  defaults: {
    skin: DEFAULT_SKIN,
    muted: false,
    focusMode: false,
    wander: true,
    connectPromptShown: false
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
    demo
  }
}

/** Saves a change and tells every pet window about it. */
export function updateSettings(change: Partial<PetSettings>): void {
  if (change.skin !== undefined) settings.set('skin', change.skin)
  if (change.muted !== undefined) settings.set('muted', change.muted)
  if (change.focusMode !== undefined) settings.set('focusMode', change.focusMode)
  if (change.wander !== undefined) settings.set('wander', change.wander)
  if (change.demo !== undefined) demo = change.demo
  const current = petSettings()
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.settings, current)
}

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC.getSettings, () => petSettings())
}
