// What the Settings buttons do (restore a backup, check for updates, reset things…), behind one
// IPC call. Each action answers with a short message for the user.
import { app, ipcMain, shell } from 'electron'
import { restoreLatestBackup } from '../../scripts/claude-settings.mjs'
import { type ActionResult, IPC, SETTINGS_ACTIONS, type SettingsAction } from '../shared/ipc'
import { disconnectClaude, openWelcomeWindow } from './connect'
import { newPhoneTopic } from './phone'
import { resetProgress, resetStats } from './progress'
import { resetSettings } from './settings'
import { checkForUpdatesNow } from './updater'
import { resetPetPosition } from './window'

async function run(action: SettingsAction): Promise<ActionResult> {
  switch (action) {
    case 'disconnectClaude':
      disconnectClaude()
      return { ok: true, message: 'Disconnected. Your previous status line is back.' }
    case 'restoreClaudeBackup': {
      const { restored, backupPath } = restoreLatestBackup()
      if (!restored) return { ok: false, message: 'No AgentPet backup found.' }
      return {
        ok: true,
        message: `Restored ${restored}. The file you had is saved as ${backupPath}.`
      }
    }
    case 'newPhoneTopic':
      return { ok: true, message: newPhoneTopic() }
    case 'checkUpdates':
      return { ok: true, message: await checkForUpdatesNow() }
    case 'resetPosition':
      resetPetPosition()
      return { ok: true }
    case 'replayOnboarding':
      openWelcomeWindow()
      return { ok: true }
    case 'resetStats':
      resetStats()
      return { ok: true, message: 'Stats cleared. Level and accessories are kept.' }
    case 'resetProgress':
      resetProgress()
      return { ok: true, message: 'A brand-new kitten! Only the name is kept.' }
    case 'resetSettings':
      resetSettings()
      return { ok: true, message: 'Settings are back to their defaults.' }
    case 'openDataFolder': {
      const error = await shell.openPath(app.getPath('userData'))
      return error ? { ok: false, message: error } : { ok: true }
    }
  }
}

export function registerActionsIpc(): void {
  ipcMain.handle(IPC.action, async (_, action: unknown): Promise<ActionResult> => {
    if (!SETTINGS_ACTIONS.includes(action as SettingsAction))
      return { ok: false, message: 'Unknown action.' }
    try {
      return await run(action as SettingsAction)
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  })
  ipcMain.handle(IPC.appInfo, () => ({
    version: app.getVersion(),
    dataPath: app.getPath('userData')
  }))
}
