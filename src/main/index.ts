import { BrowserWindow, app } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerActionsIpc } from './actions'
import { lastAgentActivity, startBridge } from './bridge'
import {
  disconnectClaude,
  openWelcomeWindow,
  registerConnectIpc,
  shouldShowWelcome,
  upgradeClaude
} from './connect'
import { musicPlaying, registerMusic } from './music'
import { registerPagesIpc } from './pages'
import { inFocusRound, onPomodoroChange, registerPomodoro } from './pomodoro'
import { startPhone } from './phone'
import { registerProgressIpc } from './progress'
import { petSettings, registerSettingsIpc } from './settings'
import { createTray, refreshTray } from './tray'
import { startUpdater } from './updater'
import { startWander } from './wander'
import { createPetWindow } from './window'

// The uninstaller runs "AgentPet.exe --disconnect-claude" before deleting the app, so Claude Code
// isn't left with hooks pointing at files that no longer exist.
if (process.argv.includes('--disconnect-claude')) {
  try {
    disconnectClaude()
  } catch (err) {
    console.error('[agentpet] could not disconnect Claude Code:', err)
  }
  app.exit(0)
}
// One pet at a time (the event server will need a single owner of its port).
else if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.agentpet.app')
    app.dock?.hide() // a pet, not a regular app

    // F12 opens DevTools in dev; Ctrl+R is ignored in production.
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    registerSettingsIpc()
    startBridge()
    // an update may change the hooks (0.4.1: Node script -> curl): bring Claude Code along
    upgradeClaude()
    registerConnectIpc(refreshTray, () => lastAgentActivity() > 0)
    registerPagesIpc()
    registerActionsIpc()
    registerPomodoro()
    startPhone()
    registerProgressIpc(refreshTray)
    // before the pet window exists, so it gets the current song once it has loaded
    registerMusic(petSettings().music)
    const pet = createPetWindow()
    createTray()
    onPomodoroChange(refreshTray)
    startUpdater(refreshTray)
    startWander(pet, {
      enabled: () => {
        const s = petSettings()
        // music outranks wandering: he stays put and vibes
        return s.wander && !s.focusMode && !s.demo && !musicPlaying() && !inFocusRound()
      },
      lastActivity: lastAgentActivity
    })

    // first run of a new install: skin, name, Claude Code, extras (once; tray › Run setup again)
    if (shouldShowWelcome()) openWelcomeWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createPetWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
