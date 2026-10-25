// Small regular windows (Connect, Profile) that show one renderer page, one window per page.
import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC } from '../shared/ipc'

export type Page = 'connect' | 'profile'

const open = new Map<Page, BrowserWindow>()

export function openPage(
  page: Page,
  { title, width, height }: { title: string; width: number; height: number }
): BrowserWindow {
  const existing = open.get(page)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return existing
  }
  const win = new BrowserWindow({
    width,
    height,
    resizable: false,
    maximizable: false,
    minimizable: false,
    title,
    autoHideMenuBar: true,
    backgroundColor: '#2a3142',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  open.set(page, win)
  win.on('closed', () => open.delete(page))
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${page}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: page })
  }
  return win
}

/** Page windows may close themselves; the pet window never can. */
export function registerPagesIpc(): void {
  ipcMain.on(IPC.closeWindow, (e) => {
    for (const win of open.values()) if (e.sender === win.webContents) win.close()
  })
}
