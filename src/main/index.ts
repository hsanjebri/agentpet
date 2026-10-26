import { BrowserWindow, app } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { lastAgentActivity, startBridge } from './bridge'
import { isConnected, openConnectWindow, registerConnectIpc } from './connect'
import { musicPlaying, registerMusic } from './music'
import { registerPagesIpc } from './pages'
import { startPhone } from './phone'
import { registerProgressIpc } from './progress'
import { petSettings, registerSettingsIpc, settings } from './settings'
import { createTray, refreshTray } from './tray'
import { startWander } from './wander'
import { createPetWindow } from './window'

// One pet at a time (the event server will need a single owner of its port).
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.agentpet.app')
    app.dock?.hide() // a pet, not a regular app

    // F12 opens DevTools in dev; Ctrl+R is ignored in production.
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    registerSettingsIpc(() => refreshTray())
    startBridge()
    registerConnectIpc(refreshTray)
    registerPagesIpc()
    startPhone()
    registerProgressIpc(refreshTray)
    // before the pet window exists, so it gets the current song once it has loaded
    registerMusic(petSettings().music)
    const pet = createPetWindow()
    createTray()
    startWander(pet, {
      enabled: () => {
        const s = petSettings()
        // music outranks wandering: he stays put and vibes
        return s.wander && !s.focusMode && !s.demo && !musicPlaying()
      },
      lastActivity: lastAgentActivity
    })

    // first run: offer to connect Claude Code (once)
    if (!isConnected() && !settings.get('connectPromptShown')) {
      settings.set('connectPromptShown', true)
      openConnectWindow()
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createPetWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
