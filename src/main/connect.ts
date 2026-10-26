// First-run Welcome window (skin, name, Claude Code, extras) and "Connect Claude Code": shows
// what will be added to Claude Code's settings and adds it with one click (backup first).
import { spawn } from 'child_process'
import { BrowserWindow, ipcMain } from 'electron'
import { agentPetEntries } from '../../scripts/claude-hooks.mjs'
import {
  CURL_CONFIG_PATH,
  SETTINGS_PATH,
  connect,
  disconnect,
  isConnected,
  isUpToDate,
  previousStatusLine,
  upgrade
} from '../../scripts/claude-settings.mjs'
import { type ConnectResult, type ConnectStatus, IPC } from '../shared/ipc'
import { openPage } from './pages'
import { openPhoneWindow } from './phone'
import { settings } from './settings'

export { isConnected }

const STATUS_LINE_TIMEOUT_MS = 2000

export function openConnectWindow(): void {
  openPage('connect', { title: 'Connect Claude Code', width: 480, height: 600 })
}

export function openWelcomeWindow(): void {
  settings.set('setupShown', true)
  openPage('welcome', { title: 'Welcome to AgentPet', width: 540, height: 640 })
}

/** First launch of a new install (people who saw the old Connect window are past it). */
export function shouldShowWelcome(): boolean {
  return !settings.get('setupShown') && !settings.get('connectPromptShown')
}

export function disconnectClaude(): void {
  disconnect()
}

/** Older installs (e.g. the Node hooks) are switched to the current hooks, with a backup. */
export function upgradeClaude(): void {
  try {
    const { upgraded, backupPath } = upgrade(CURL_CONFIG_PATH)
    if (upgraded) console.log(`[agentpet] updated Claude Code hooks (backup: ${backupPath})`)
  } catch (err) {
    console.error('[agentpet] could not update Claude Code hooks:', err)
  }
}

/**
 * Runs the status line the user had before AgentPet with what Claude Code sent, and resolves
 * with its output; null when there was none (or it failed).
 */
export function runPreviousStatusLine(raw: string): Promise<string | null> {
  const command = previousStatusLine()
  if (!command) return Promise.resolve(null)
  return new Promise((resolve) => {
    let out = ''
    const child = spawn(command, { shell: true, windowsHide: true })
    const timer = setTimeout(() => child.kill(), STATUS_LINE_TIMEOUT_MS)
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (out += chunk))
    child.on('error', () => resolve(null))
    child.on('close', () => {
      clearTimeout(timer)
      resolve(out)
    })
    child.stdin.on('error', () => {}) // the command may not read its input
    child.stdin.end(raw)
  })
}

/**
 * `onChange` runs after connecting, e.g. to refresh the tray menu. `heardFromAgent` tells
 * whether an agent event got through since the app started.
 */
export function registerConnectIpc(onChange: () => void, heardFromAgent: () => boolean): void {
  ipcMain.handle(IPC.connectStatus, (): ConnectStatus => {
    const connected = isConnected()
    return {
      connected,
      settingsPath: SETTINGS_PATH,
      preview: JSON.stringify(agentPetEntries(CURL_CONFIG_PATH), null, 2),
      outdated: connected && !isUpToDate(CURL_CONFIG_PATH),
      heardFromAgent: heardFromAgent()
    }
  })
  ipcMain.on(IPC.openPhone, () => openPhoneWindow())
  ipcMain.on(IPC.finishSetup, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close()
    for (const win of BrowserWindow.getAllWindows())
      win.webContents.send(IPC.moment, { kind: 'hello' })
  })
  ipcMain.handle(IPC.connect, (): ConnectResult => {
    try {
      const { backupPath } = connect(CURL_CONFIG_PATH)
      onChange()
      return { ok: true, backupPath }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
