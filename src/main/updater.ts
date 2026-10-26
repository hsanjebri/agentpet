// Auto-update from GitHub Releases (installed app only). Downloads new versions in the
// background, then offers "Restart to update" in the tray (or installs when the app quits).
// Settings › General can turn the automatic checks off and check by hand.
//
// Windows (NSIS) and Linux (AppImage) update themselves. macOS needs a signed app for that,
// so for now Mac users get the new .dmg from the Releases page.
import { app } from 'electron'
import electronUpdater from 'electron-updater'
import { sendMoment } from './progress'
import { onSettingsChange, storedSettings } from './settings'

const CHECK_EVERY_MS = 6 * 60 * 60_000
const FIRST_CHECK_MS = 60_000 // don't slow down start-up

let ready: string | null = null // version downloaded and waiting for a restart

export function updateReady(): string | null {
  return ready
}

export function restartToUpdate(): void {
  if (ready) electronUpdater.autoUpdater.quitAndInstall()
}

function supported(): boolean {
  return app.isPackaged && process.platform !== 'darwin'
}

/** Settings › General › Check for updates now: resolves with a short message for the user. */
export async function checkForUpdatesNow(): Promise<string> {
  if (!app.isPackaged) return 'Updates only work in the installed app.'
  if (process.platform === 'darwin')
    return 'On macOS, download the new version from the Releases page for now.'
  if (ready) return `Version ${ready} is ready: restart to update.`
  try {
    const result = await electronUpdater.autoUpdater.checkForUpdates()
    const latest = result?.updateInfo.version
    if (!latest || latest === app.getVersion()) return `You're up to date (${app.getVersion()}).`
    return `Downloading version ${latest}… you'll see "Restart to update" when it's ready.`
  } catch {
    return "Couldn't check right now (offline?). Try again later."
  }
}

/** `onReady` lets the tray show "Restart to update". */
export function startUpdater(onReady: () => void): void {
  if (!supported()) return
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
    if (storedSettings().autoUpdate) autoUpdater.checkForUpdates().catch(() => {})
  }
  setTimeout(check, FIRST_CHECK_MS)
  setInterval(check, CHECK_EVERY_MS)
  onSettingsChange((now, before) => {
    if (now.autoUpdate && !before.autoUpdate) check()
  })
}
