import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type PetApi } from '../shared/ipc'

/** Subscribes to a main → renderer channel; returns the unsubscribe function. */
function listen<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_: IpcRendererEvent, value: T): void => listener(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: PetApi = {
  setInteractive: (interactive) => ipcRenderer.send(IPC.setInteractive, interactive),
  dragStart: () => ipcRenderer.send(IPC.dragStart),
  dragEnd: () => ipcRenderer.invoke(IPC.dragEnd),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  onSettings: (listener) => listen(IPC.settings, listener),
  onAgentEvent: (listener) => listen(IPC.agentEvent, listener),
  onUsage: (listener) => listen(IPC.usage, listener),
  onPermissions: (listener) => listen(IPC.permissions, listener),
  decide: (id, decision) => ipcRenderer.send(IPC.decide, id, decision),
  onSession: (listener) => listen(IPC.session, listener),
  setAlert: (on) => ipcRenderer.send(IPC.setAlert, on),
  petClicked: () => ipcRenderer.send(IPC.petClicked),
  connectStatus: () => ipcRenderer.invoke(IPC.connectStatus),
  connect: () => ipcRenderer.invoke(IPC.connect),
  closeWindow: () => ipcRenderer.send(IPC.closeWindow),
  getLook: () => ipcRenderer.invoke(IPC.getLook),
  onLook: (listener) => listen(IPC.look, listener),
  onMoment: (listener) => listen(IPC.moment, listener),
  onWalk: (listener) => listen(IPC.walk, listener),
  getProfile: () => ipcRenderer.invoke(IPC.getProfile),
  setPetName: (name) => ipcRenderer.send(IPC.setPetName, name),
  setWearing: (items) => ipcRenderer.send(IPC.setWearing, items),
  saveCard: (dataUrl, fileName) => ipcRenderer.invoke(IPC.saveCard, dataUrl, fileName),
  copyCard: (dataUrl) => ipcRenderer.send(IPC.copyCard, dataUrl),
  share: (text) => ipcRenderer.send(IPC.share, text),
  onMusic: (listener) => listen(IPC.music, listener),
  musicCommand: (command) => ipcRenderer.send(IPC.musicCmd, command),
  setMusic: (on) => ipcRenderer.send(IPC.setMusic, on)
}

contextBridge.exposeInMainWorld('api', api)
