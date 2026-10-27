// Tray icon + menu, and the pet's right-click menu. Both stay short: everything else is in
// Settings.
import { Menu, type MenuItemConstructorOptions, Tray, app, ipcMain, nativeImage } from 'electron'
import { IPC } from '../shared/ipc'
import { friendsService } from './friends'
import { visitFriend } from './visits'
import { openProfileWindow, openSettingsWindow } from './pages'
import { pomodoroMenuItems } from './pomodoro'
import { petName } from './progress'
import { onSettingsChange, petSettings, updateSettings } from './settings'
import { restartToUpdate, updateReady } from './updater'
// tray@2x.png next to it is picked up automatically on high-DPI screens
import trayIcon from '../../resources/tray.png?asset'

let tray: Tray | null = null // module-level so it isn't garbage collected

const settingsItem = (): MenuItemConstructorOptions => ({
  label: 'Settings…',
  click: () => openSettingsWindow()
})

const profileItem = (): MenuItemConstructorOptions => ({
  label: `${petName()}'s profile & recap…`,
  click: () => openProfileWindow(petName())
})

function buildMenu(): Menu {
  const current = petSettings()
  const update = updateReady()
  return Menu.buildFromTemplate([
    settingsItem(),
    profileItem(),
    { type: 'separator' },
    ...pomodoroMenuItems(),
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
    { type: 'separator' },
    ...(update ? [{ label: `Restart to update to ${update} ✨`, click: restartToUpdate }] : []),
    { label: 'Quit AgentPet', role: 'quit' }
  ])
}

/** Online friends you can send him to (only when Friends is on). */
function visitMenu(): MenuItemConstructorOptions[] {
  const view = friendsService().current()
  if (view.status !== 'online') return []
  const online = view.friends.filter((f) => f.online)
  return [
    {
      label: 'Visit a friend',
      submenu: online.length
        ? online.map((f) => ({ label: `${f.name} 🟢`, click: () => void visitFriend(f.userId) }))
        : [{ label: 'No friends online right now', enabled: false }]
    }
  ]
}

/** Right-click on the pet. */
function petMenu(): Menu {
  return Menu.buildFromTemplate([
    ...pomodoroMenuItems(),
    { label: 'Sticky note…', click: () => openSettingsWindow('daily') },
    ...visitMenu(),
    { type: 'separator' },
    settingsItem(),
    profileItem()
  ])
}

export function refreshTray(): void {
  tray?.setContextMenu(buildMenu())
}

export function createTray(): Tray {
  tray = new Tray(nativeImage.createFromPath(trayIcon))
  tray.setToolTip(`AgentPet ${app.getVersion()}`)
  refreshTray()
  onSettingsChange(() => refreshTray())
  ipcMain.on(IPC.petMenu, () => petMenu().popup())
  ipcMain.on(IPC.openSettings, (_, section: unknown) =>
    openSettingsWindow(typeof section === 'string' ? section : undefined)
  )
  return tray
}
