// Tray icon + menu: Skin ▸, Mute, Quit.
import { Menu, Tray, app, nativeImage } from 'electron'
import { SKINS } from '../shared/skins'
import { petSettings, updateSettings } from './settings'
import icon from '../../resources/icon.png?asset'

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
          refresh()
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
      label: 'Mood demo',
      type: 'checkbox',
      checked: current.demo,
      click: (item) => updateSettings({ demo: item.checked })
    },
    { type: 'separator' },
    { label: 'Quit AgentPet', role: 'quit' }
  ])
}

function refresh(): void {
  tray?.setContextMenu(buildMenu())
}

export function createTray(): Tray {
  const size = process.platform === 'darwin' ? 18 : 16
  const image = nativeImage.createFromPath(icon).resize({ width: size, height: size })
  tray = new Tray(image)
  tray.setToolTip(`AgentPet ${app.getVersion()}`)
  refresh()
  return tray
}
