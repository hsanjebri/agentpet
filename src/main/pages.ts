// Small regular windows (Welcome, Connect, Profile, Phone) that show one renderer page, one window per page.
import { BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC } from '../shared/ipc'

export type Page = 'welcome' | 'settings' | 'connect' | 'profile' | 'phone'

const open = new Map<Page, BrowserWindow>()

interface PageOptions {
  title: string
  width: number
  height: number
  /** resizable down to this size */
  min?: { width: number; height: number }
  /** extra hash after the page name, e.g. "settings:claude" */
  sub?: string
}

export function openPage(
  page: Page,
  { title, width, height, min, sub }: PageOptions
): BrowserWindow {
  const existing = open.get(page)
  if (existing && !existing.isDestroyed()) {
    if (sub) existing.webContents.send(IPC.showSection, sub)
    existing.focus()
    return existing
  }
  const hash = sub ? `${page}:${sub}` : page
  const win = new BrowserWindow({
    width,
    height,
    resizable: Boolean(min),
    minWidth: min?.width,
    minHeight: min?.height,
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
  // links (About, Phone ping) open in the browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  open.set(page, win)
  win.on('closed', () => open.delete(page))
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
  return win
}

/** Settings, optionally at a section (e.g. "claude"). */
export function openSettingsWindow(section?: string): void {
  openPage('settings', {
    title: 'AgentPet Settings',
    width: 760,
    height: 580,
    min: { width: 480, height: 400 },
    sub: section
  })
}

export function openProfileWindow(title: string): void {
  openPage('profile', { title, width: 520, height: 640 })
}

/** Page windows may close themselves; the pet window never can. */
export function registerPagesIpc(): void {
  ipcMain.on(IPC.closeWindow, (e) => {
    for (const win of open.values()) if (e.sender === win.webContents) win.close()
  })
}
