// Music: runs the nowplaying helper (Windows only), forwards what's playing to the pet window,
// and passes play/pause/next/prev from the pet's buttons to the helper.
import { type ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { BrowserWindow, app, ipcMain } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  LineBuffer,
  MUSIC_COMMANDS,
  type MusicCommand,
  type MusicState,
  NO_MUSIC,
  isNewSong,
  parseMusicLine,
  restartDelay
} from '../shared/music'
import { IPC } from '../shared/ipc'
import { recordActivity } from './progress'
import { MUSIC_SUPPORTED, onSettingsChange } from './settings'

export { MUSIC_SUPPORTED }

/** A run this long counts as healthy: the next crash starts the backoff from scratch. */
const STABLE_MS = 60_000

let helper: ChildProcessWithoutNullStreams | null = null
let wanted = false
let crashes = 0
let restartTimer: NodeJS.Timeout | undefined
let state: MusicState = NO_MUSIC

function helperPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'nowplaying', 'nowplaying.exe')
    : join(app.getAppPath(), 'helper', 'nowplaying', 'dist', 'nowplaying.exe')
}

function broadcast(music: MusicState): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.music, music)
}

function onState(next: MusicState): void {
  if (isNewSong(state, next)) recordActivity({ type: 'song' })
  state = next
  broadcast(next)
}

export function musicPlaying(): boolean {
  return state.playing
}

function start(): void {
  if (helper || !wanted) return
  const path = helperPath()
  if (!existsSync(path)) {
    console.error(`[agentpet] music helper not found at ${path} (run npm run helper:build)`)
    return
  }

  const child = spawn(path, [], { windowsHide: true })
  helper = child
  const startedAt = Date.now()
  const lines = new LineBuffer()
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    for (const line of lines.push(chunk)) {
      const music = parseMusicLine(line)
      if (music) onState(music)
    }
  })
  child.stderr.on('data', (chunk: Buffer) => console.error('[nowplaying]', String(chunk).trim()))
  child.on('error', (err) => console.error('[agentpet] music helper failed:', err.message))
  child.on('exit', (code) => {
    if (helper === child) helper = null
    onState(NO_MUSIC)
    if (!wanted) return
    if (Date.now() - startedAt > STABLE_MS) crashes = 0
    const delay = restartDelay(crashes++)
    if (delay === null) {
      console.error('[agentpet] music helper keeps exiting; giving up until Music is toggled')
      return
    }
    console.error(`[agentpet] music helper exited (${code}); restarting in ${delay} ms`)
    restartTimer = setTimeout(start, delay)
  })
}

function stop(): void {
  clearTimeout(restartTimer)
  const child = helper
  helper = null
  child?.kill()
  onState(NO_MUSIC)
}

/** Turns the feature on / off (tray, first-run window). */
export function setMusicEnabled(on: boolean): void {
  if (!MUSIC_SUPPORTED) return
  wanted = on
  crashes = 0
  if (on) start()
  else stop()
}

export function registerMusic(enabled: boolean): void {
  ipcMain.on(IPC.musicCmd, (_, command: unknown) => {
    if (!MUSIC_COMMANDS.includes(command as MusicCommand)) return
    helper?.stdin.write(`${command}\n`)
  })
  // a (re)loaded window gets the current state
  app.on('browser-window-created', (_, win) => {
    win.webContents.on('did-finish-load', () => win.webContents.send(IPC.music, state))
  })
  app.on('before-quit', () => {
    wanted = false
    stop()
  })
  setMusicEnabled(enabled)
  onSettingsChange((now, before) => {
    if (now.music !== before.music) setMusicEnabled(now.music)
  })
}
