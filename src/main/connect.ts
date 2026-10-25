// "Connect Claude Code": a small window that shows what will be added to Claude Code's
// settings and adds it with one click (backup first). Also used by the tray.
import { execFile } from 'child_process'
import { app, ipcMain } from 'electron'
import { join } from 'path'
import { agentPetEntries } from '../../scripts/claude-hooks.mjs'
import { SETTINGS_PATH, connect, disconnect, isConnected } from '../../scripts/claude-settings.mjs'
import { type ConnectResult, type ConnectStatus, IPC } from '../shared/ipc'
import { openPage } from './pages'

export { isConnected }

/** The hook script Claude Code runs. Packaged builds ship it as an extra resource. */
export function cliPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'cli', 'agentpet-send.mjs')
    : join(app.getAppPath(), 'cli', 'agentpet-send.mjs')
}

/** The Node version the hooks will run with, or null when `node` can't be found. */
function nodeVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      'node',
      ['--version'],
      { timeout: 5000, windowsHide: true, shell: process.platform === 'win32' },
      (err, stdout) => resolve(err ? null : stdout.trim())
    )
  })
}

export function openConnectWindow(): void {
  openPage('connect', { title: 'Connect Claude Code', width: 480, height: 600 })
}

export function disconnectClaude(): void {
  disconnect()
}

/** `onChange` runs after connecting, e.g. to refresh the tray menu. */
export function registerConnectIpc(onChange: () => void): void {
  ipcMain.handle(IPC.connectStatus, async (): Promise<ConnectStatus> => ({
    connected: isConnected(),
    settingsPath: SETTINGS_PATH,
    preview: JSON.stringify(agentPetEntries(cliPath()), null, 2),
    nodeVersion: await nodeVersion()
  }))
  ipcMain.handle(IPC.connect, (): ConnectResult => {
    try {
      const { backupPath } = connect(cliPath())
      onChange()
      return { ok: true, backupPath }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
