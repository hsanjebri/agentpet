// Sticky notes: "remind me: buy bread". He holds the oldest one until you click Done.
// Kept in notes.json in the app's data folder; nothing leaves the PC.
import { randomUUID } from 'crypto'
import { BrowserWindow, ipcMain } from 'electron'
import Store from 'electron-store'
import { IPC, type StickyNote } from '../shared/ipc'

const MAX_NOTES = 20
const MAX_TEXT = 120

const store = new Store<{ notes: StickyNote[] }>({ name: 'notes', defaults: { notes: [] } })

function notes(): StickyNote[] {
  const list = store.get('notes')
  return Array.isArray(list) ? list : []
}

function save(list: StickyNote[]): void {
  store.set('notes', list)
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.notes, list)
}

export function startNotes(): void {
  ipcMain.handle(IPC.getNotes, () => notes())
  ipcMain.on(IPC.addNote, (_, text: unknown) => {
    if (typeof text !== 'string' || !text.trim()) return
    const note: StickyNote = {
      id: randomUUID(),
      text: text.trim().slice(0, MAX_TEXT),
      at: Date.now()
    }
    save([...notes(), note].slice(-MAX_NOTES))
  })
  ipcMain.on(IPC.doneNote, (_, id: unknown) => save(notes().filter((n) => n.id !== id)))
}
