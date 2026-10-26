// The Pomodoro timer: owns the state, ticks it every second, rewards finished focus rounds
// (a fish and XP) and tells the windows. Started from the tray, the pet's right-click menu or
// Settings. Local only.
import { BrowserWindow, type MenuItemConstructorOptions, app, ipcMain } from 'electron'
import { IPC } from '../shared/ipc'
import {
  IDLE,
  POMODORO_COMMANDS,
  type PomodoroCommand,
  type PomodoroEvent,
  type PomodoroState,
  command,
  phaseLabel,
  tick
} from '../shared/pomodoro'
import { pomodorosToday, recordActivity, sendMoment } from './progress'
import { storedSettings } from './settings'

let state: PomodoroState = IDLE
let timer: NodeJS.Timeout | undefined
const listeners: Array<() => void> = []

export function pomodoroState(): PomodoroState {
  return { ...state, today: pomodorosToday() }
}

/** True during a focus round: wandering, greetings and quiet moods pause. */
export function inFocusRound(): boolean {
  return state.phase === 'focus' && state.pausedLeftMs === null
}

/** E.g. the tray relabels itself. */
export function onPomodoroChange(listener: () => void): void {
  listeners.push(listener)
}

function changed(): void {
  const now = pomodoroState()
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.pomodoro, now)
  for (const listener of listeners) listener()
  // tick only while something runs
  if (state.phase && !timer) timer = setInterval(onTick, 1000)
  if (!state.phase && timer) {
    clearInterval(timer)
    timer = undefined
  }
}

function handle(events: PomodoroEvent[]): void {
  for (const event of events) {
    if (event === 'focus_done') recordActivity({ type: 'pomodoro' })
    sendMoment({ kind: 'pomodoro', event, fish: storedSettings().feeding })
  }
}

function onTick(): void {
  const { state: next, events } = tick(state, storedSettings().pomodoro, Date.now())
  if (next === state) return
  state = next
  handle(events)
  changed()
}

export function pomodoroCommand(cmd: PomodoroCommand): void {
  const { state: next, events } = command(state, cmd, storedSettings().pomodoro, Date.now())
  state = next
  handle(events)
  changed()
}

/** For the tray and the pet's right-click menu. */
export function pomodoroMenuItems(): MenuItemConstructorOptions[] {
  if (!state.phase) return [{ label: 'Start Pomodoro 🍅', click: () => pomodoroCommand('start') }]
  const paused = state.pausedLeftMs !== null
  return [
    { label: `${phaseLabel(state)}${paused ? ' (paused)' : ''}`, enabled: false },
    paused
      ? { label: 'Resume', click: () => pomodoroCommand('resume') }
      : { label: 'Pause', click: () => pomodoroCommand('pause') },
    { label: 'Skip', click: () => pomodoroCommand('skip') },
    { label: 'Stop Pomodoro', click: () => pomodoroCommand('stop') }
  ]
}

export function registerPomodoro(): void {
  ipcMain.handle(IPC.getPomodoro, () => pomodoroState())
  ipcMain.on(IPC.pomodoroCmd, (_, cmd: unknown) => {
    if (POMODORO_COMMANDS.includes(cmd as PomodoroCommand)) pomodoroCommand(cmd as PomodoroCommand)
  })
  app.on('before-quit', () => clearInterval(timer))
}
