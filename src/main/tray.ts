// Tray icon + menu: skin, mute, focus mode, start on login, demo, connect, quit.
import { Menu, Tray, app, nativeImage } from 'electron'
import { SKINS } from '../shared/skins'
import { disconnectClaude, isConnected, openConnectWindow } from './connect'
import { petSettings, updateSettings } from './settings'
// tray@2x.png next to it is picked up automatically on high-DPI screens
import trayIcon from '../../resources/tray.png?asset'

let tray: Tray | null = null // module-level so it isn't garbage collected

function buildMenu(): Menu {
  const current = petSettings()
  return Menu.buildFromTemplate([
    {
      label: 'Skin',
      submenu: SKINS.map((skin) => ({
        label: skin.ready ? skin.name : `${skin.name} (coming soon)`,
        type: 'radio' as const,
        checked: skin.id === current.skin,
        enabled: skin.ready,
        click: () => {
          updateSettings({ skin: skin.id })
          refreshTray()
        }
      }))
    },
    {
      label: 'Mute',
      type: 'checkbox',
      checked: current.muted,
      click: (item) => updateSettings({ muted: item.checked })
    },
    {
      label: 'Focus mode (only show up when needed)',
      type: 'checkbox',
      checked: current.focusMode,
      click: (item) => updateSettings({ focusMode: item.checked })
    },
    {
      // registering the dev build would start a bare Electron at login
      label: app.isPackaged ? 'Start on login' : 'Start on login (installed app only)',
      type: 'checkbox',
      enabled: app.isPackaged,
      checked: app.isPackaged && app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
    },
    {
      label: 'Mood demo',
      type: 'checkbox',
      checked: current.demo,
      click: (item) => updateSettings({ demo: item.checked })
    },
    { type: 'separator' },
    isConnected()
      ? {
          label: 'Disconnect Claude Code',
          click: () => {
            disconnectClaude()
            refreshTray()
          }
        }
      : { label: 'Connect Claude Code…', click: openConnectWindow },
    { type: 'separator' },
    { label: 'Quit AgentPet', role: 'quit' }
  ])
}

export function refreshTray(): void {
  tray?.setContextMenu(buildMenu())
}

export function createTray(): Tray {
  tray = new Tray(nativeImage.createFromPath(trayIcon))
  tray.setToolTip(`AgentPet ${app.getVersion()}`)
  refreshTray()
  return tray
}
