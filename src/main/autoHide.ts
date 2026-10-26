// Auto-hide (Windows): a small PowerShell loop reports every few seconds whether a fullscreen app
// is in front, the microphone is in use, or Do not disturb is on; the pet steps aside while any of
// the switched-on reasons applies. Runs only while one of the switches is on. Read-only, local.
import { type ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { app } from 'electron'
import { LineBuffer } from '../shared/music'
import { VISIBLE, anyAutoHide, hideReason, parseOsLine, type OsState } from '../shared/autoHide'
import { AUTO_HIDE_SUPPORTED, onSettingsChange, storedSettings } from './settings'
import { setAutoHidden } from './window'

const CHECK_SECONDS = 3

// SHQueryUserNotificationState: 2 busy (fullscreen), 3 D3D fullscreen, 4 presentation, 7 app
// fullscreen. Microphone: an app whose LastUsedTimeStop is 0 is using it right now. DND: Windows
// turns notification toasts off. Exits when AgentPet is gone, so it never lingers.
const SCRIPT = (parent: number): string => `
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class AgentPetShell {
  [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);
}
'@
$mics = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone'
$notes = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings'
$last = ''
while ($true) {
  if (-not (Get-Process -Id ${parent} -ErrorAction SilentlyContinue)) { exit }
  $s = 0; [void][AgentPetShell]::SHQueryUserNotificationState([ref]$s)
  $full = $s -in 2, 3, 4, 7
  $mic = $false
  foreach ($k in (Get-ChildItem $mics -Recurse -ErrorAction SilentlyContinue)) {
    $p = Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue
    if ($p -and $null -ne $p.LastUsedTimeStart -and $p.LastUsedTimeStop -eq 0) { $mic = $true; break }
  }
  $dnd = (Get-ItemProperty $notes -ErrorAction SilentlyContinue).NOC_GLOBAL_SETTING_TOASTS_ENABLED -eq 0
  $line = '{"fullscreen":' + "$full".ToLower() + ',"mic":' + "$mic".ToLower() + ',"dnd":' + "$dnd".ToLower() + '}'
  if ($line -ne $last) { [Console]::Out.WriteLine($line); [Console]::Out.Flush(); $last = $line }
  Start-Sleep -Seconds ${CHECK_SECONDS}
}`

let watcher: ChildProcessWithoutNullStreams | null = null
let os: OsState = VISIBLE

function apply(): void {
  const reason = watcher ? hideReason(os, storedSettings().autoHide) : null
  setAutoHidden(reason !== null)
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
      const next = parseOsLine(line)
      if (next) {
        os = next
        apply()
      }
    }
  })
  child.on('error', () => {})
  child.on('exit', () => {
    if (watcher === child) watcher = null
    os = VISIBLE
    apply()
  })
}

function stop(): void {
  const child = watcher
  watcher = null
  os = VISIBLE
  child?.kill()
  apply()
}

function update(): void {
  if (AUTO_HIDE_SUPPORTED && anyAutoHide(storedSettings().autoHide)) start()
  else stop()
  apply()
}

export function startAutoHide(): void {
  update()
  onSettingsChange((now, before) => {
    if (JSON.stringify(now.autoHide) !== JSON.stringify(before.autoHide)) update()
  })
  app.on('before-quit', stop)
}
