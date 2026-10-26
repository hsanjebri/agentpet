// Friends, Electron side: the Supabase project from config/supabase.json, the anonymous session
// kept encrypted on disk, and the IPC for Settings › Friends. Friends is off by default; while
// it's off the Supabase library isn't loaded and nothing goes over the network.
import { BrowserWindow, ipcMain, safeStorage } from 'electron'
import Store from 'electron-store'
import supabaseConfig from '../../config/supabase.json'
import type { FriendsCommand } from '../shared/friends'
import { IPC } from '../shared/ipc'
import { FriendsService, type SessionStorage } from './friendsService'
import { petLevel, petName } from './progress'
import { onSettingsChange, storedSettings } from './settings'

const store = new Store<{ session: Record<string, string> }>({
  name: 'friends',
  defaults: { session: {} }
})

const ENC = 'enc:'

/** Supabase's auth storage, encrypted with the OS keychain when available. */
const storage: SessionStorage = {
  getItem(key) {
    const value = store.get('session')[key]
    if (value === undefined) return null
    if (!value.startsWith(ENC)) return value
    try {
      return safeStorage.decryptString(Buffer.from(value.slice(ENC.length), 'base64'))
    } catch {
      return null
    }
  },
  setItem(key, value) {
    const saved = safeStorage.isEncryptionAvailable()
      ? ENC + safeStorage.encryptString(value).toString('base64')
      : value
    store.set('session', { ...store.get('session'), [key]: saved })
  },
  removeItem(key) {
    const session = { ...store.get('session') }
    delete session[key]
    store.set('session', session)
  }
}

const service = new FriendsService({
  config: supabaseConfig,
  // loaded only here, the first time Friends connects
  createClient: async (url, key, options) =>
    (await import('@supabase/supabase-js')).createClient(url, key, options),
  storage,
  pet: () => ({ name: petName(), skin: storedSettings().skin, level: petLevel() }),
  onView: (view) => {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.friends, view)
  }
})

export function startFriends(): void {
  ipcMain.handle(IPC.getFriends, () => service.current())
  ipcMain.handle(IPC.friendsCmd, (_, command: FriendsCommand) => {
    if (!storedSettings().friends) return { ok: false, message: 'Friends is off.' }
    return service.command(command)
  })
  onSettingsChange((now, before) => {
    if (now.friends && !before.friends) void service.enable()
    if (!now.friends && before.friends) service.disable()
    if (now.friends && now.skin !== before.skin) void service.syncPet().catch(() => {})
  })
  if (storedSettings().friends) void service.enable()
}
