import { BrowserWindow, app } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { startBridge } from './bridge'
import { registerSettingsIpc } from './settings'
import { createTray } from './tray'
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

    registerSettingsIpc()
    startBridge()
    createPetWindow()
    createTray()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createPetWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
