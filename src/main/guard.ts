// Distraction guard (Windows): only during a Pomodoro focus round, a small PowerShell loop reports
// the window in front (title + position). If it's one of the distracting sites, he walks over and
// sits on it: "Focus first 😾". Click him to shoo him away (that site is left alone for 5 min).
// Titles are only compared here, never stored or sent.
import { type ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { app, ipcMain, screen } from 'electron'
import { type ForegroundWindow, distractionIn, parseWindowLine } from '../shared/guard'
import { IPC } from '../shared/ipc'
import { LineBuffer } from '../shared/music'
import { dailyState, setDaily, snoozeBedtime } from './daily'
import { inFocusRound, onPomodoroChange } from './pomodoro'
import { sendMoment } from './progress'
import { onSettingsChange, storedSettings } from './settings'
import { leaveWindow, sitOnWindow } from './window'

const SNOOZE_MS = 5 * 60_000

const SCRIPT = (parent: number): string => `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class AgentPetFg {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
'@
$last = ''
while ($true) {
  if (-not (Get-Process -Id ${parent} -ErrorAction SilentlyContinue)) { exit }
  $h = [AgentPetFg]::GetForegroundWindow()
  $sb = New-Object System.Text.StringBuilder 512
  [void][AgentPetFg]::GetWindowText($h, $sb, 512)
  $r = New-Object AgentPetFg+RECT
  [void][AgentPetFg]::GetWindowRect($h, [ref]$r)
  $p = [uint32]0
  [void][AgentPetFg]::GetWindowThreadProcessId($h, [ref]$p)
  $line = @{ title = $sb.ToString(); x = $r.L; y = $r.T; w = $r.R - $r.L; h = $r.B - $r.T; pid = $p } | ConvertTo-Json -Compress
  if ($line -ne $last) { [Console]::Out.WriteLine($line); [Console]::Out.Flush(); $last = $line }
  Start-Sleep -Milliseconds 1500
}`

let watcher: ChildProcessWithoutNullStreams | null = null
const snoozed = new Map<string, number>() // site -> until

function wanted(): boolean {
  return process.platform === 'win32' && storedSettings().guard.enabled && inFocusRound()
}

function stopGuarding(): void {
  if (!dailyState().guarding) return
  setDaily({ guarding: null })
  leaveWindow()
}

function onWindow(w: ForegroundWindow): void {
  // our own windows (Settings…) never count
  if (w.pid === process.pid || w.width < 200 || w.height < 150) return stopGuarding()
  const site = distractionIn(w.title, storedSettings().guard.sites)
  if (!site || (snoozed.get(site) ?? 0) > Date.now()) return stopGuarding()
  const bounds = screen.screenToDipRect(null, {
    x: w.x,
    y: w.y,
    width: w.width,
    height: w.height
  })
  const fresh = dailyState().guarding !== site
  setDaily({ guarding: site })
  sitOnWindow(bounds)
  if (fresh) sendMoment({ kind: 'distraction', site })
}

function start(): void {
  if (watcher) return
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', SCRIPT(process.pid)],
    { windowsHide: true }
  )
  watcher = child
  const lines = new LineBuffer()
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    for (const line of lines.push(chunk)) {
      const w = parseWindowLine(line)
      if (w && wanted()) onWindow(w)
    }
  })
  child.on('error', () => {})
  child.on('exit', () => {
    if (watcher === child) watcher = null
  })
}

function stop(): void {
  const child = watcher
  watcher = null
  child?.kill()
  stopGuarding()
}

function update(): void {
  if (wanted()) start()
  else stop()
}

/** Click on him while he guards: off he goes, and that site is left alone for a while. */
function shoo(): void {
  const site = dailyState().guarding
  if (!site) return snoozeBedtime() // lying across the screen at bedtime
  snoozed.set(site, Date.now() + SNOOZE_MS)
  stopGuarding()
}

export function startGuard(): void {
  ipcMain.on(IPC.shoo, shoo)
  onPomodoroChange(update)
  onSettingsChange((now, before) => {
    if (JSON.stringify(now.guard) !== JSON.stringify(before.guard)) update()
  })
  app.on('before-quit', stop)
}
