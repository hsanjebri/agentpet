import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type PetApi, type PetSettings } from '../shared/ipc'

const api: PetApi = {
  setInteractive: (interactive) => ipcRenderer.send(IPC.setInteractive, interactive),
  dragStart: () => ipcRenderer.send(IPC.dragStart),
  dragEnd: () => ipcRenderer.invoke(IPC.dragEnd),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  onSettings: (listener) => {
    const handler = (_: IpcRendererEvent, settings: PetSettings): void => listener(settings)
    ipcRenderer.on(IPC.settings, handler)
    return () => ipcRenderer.removeListener(IPC.settings, handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
