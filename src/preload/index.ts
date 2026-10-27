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
  setMusic: (on) => ipcRenderer.send(IPC.setMusic, on),
  getPhone: () => ipcRenderer.invoke(IPC.getPhone),
  setPhone: (settings) => ipcRenderer.invoke(IPC.setPhone, settings),
  testPhone: (settings) => ipcRenderer.invoke(IPC.testPhone, settings),
  changeSettings: (change) => ipcRenderer.send(IPC.changeSettings, change),
  openPhone: () => ipcRenderer.send(IPC.openPhone),
  finishSetup: () => ipcRenderer.send(IPC.finishSetup),
  onShowSection: (listener) => listen(IPC.showSection, listener),
  petMenu: () => ipcRenderer.send(IPC.petMenu),
  openSettings: (section) => ipcRenderer.send(IPC.openSettings, section),
  action: (action) => ipcRenderer.invoke(IPC.action, action),
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  getPomodoro: () => ipcRenderer.invoke(IPC.getPomodoro),
  onPomodoro: (listener) => listen(IPC.pomodoro, listener),
  pomodoro: (command) => ipcRenderer.send(IPC.pomodoroCmd, command),
  setDemo: (on) => ipcRenderer.send(IPC.setDemo, on),
  petted: () => ipcRenderer.send(IPC.petted),
  getFriends: () => ipcRenderer.invoke(IPC.getFriends),
  onFriends: (listener) => listen(IPC.friends, listener),
  friends: (command) => ipcRenderer.invoke(IPC.friendsCmd, command),
  getDaily: () => ipcRenderer.invoke(IPC.getDaily),
  onDaily: (listener) => listen(IPC.daily, listener),
  drank: () => ipcRenderer.send(IPC.drank),
  searchPlace: (query) => ipcRenderer.invoke(IPC.searchPlace, query),
  shoo: () => ipcRenderer.send(IPC.shoo),
  stretched: () => ipcRenderer.send(IPC.stretched),
  getNotes: () => ipcRenderer.invoke(IPC.getNotes),
  onNotes: (listener) => listen(IPC.notes, listener),
  addNote: (text) => ipcRenderer.send(IPC.addNote, text),
  doneNote: (id) => ipcRenderer.send(IPC.doneNote, id)
}

contextBridge.exposeInMainWorld('api', api)
