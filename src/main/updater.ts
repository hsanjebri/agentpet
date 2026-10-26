// Auto-update from GitHub Releases (installed app only). Downloads new versions in the
// background, then offers "Restart to update" in the tray (or installs when the app quits).
//
// Windows (NSIS) and Linux (AppImage) update themselves. macOS needs a signed app for that,
// so for now Mac users get the new .dmg from the Releases page.
import { app } from 'electron'
import electronUpdater from 'electron-updater'
import { sendMoment } from './progress'

const CHECK_EVERY_MS = 6 * 60 * 60_000
const FIRST_CHECK_MS = 60_000 // don't slow down start-up

let ready: string | null = null // version downloaded and waiting for a restart

export function updateReady(): string | null {
  return ready
}

export function restartToUpdate(): void {
  if (ready) electronUpdater.autoUpdater.quitAndInstall()
}

/** `onReady` lets the tray show "Restart to update". */
export function startUpdater(onReady: () => void): void {
  if (!app.isPackaged || process.platform === 'darwin') return
  const { autoUpdater } = electronUpdater
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  autoUpdater.on('update-downloaded', (info) => {
    ready = info.version
    sendMoment({ kind: 'update', version: info.version })
    onReady()
  })
  // offline, private repo, rate limits…: never bother the user, just try again later
  autoUpdater.on('error', (err) => console.error('[agentpet] update check failed:', err.message))

  const check = (): void => {
    autoUpdater.checkForUpdates().catch(() => {})
  }
  setTimeout(check, FIRST_CHECK_MS)
  setInterval(check, CHECK_EVERY_MS)
}
