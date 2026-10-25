// Brings the agent's terminal / IDE to the front (best effort). Starts from the agent's process
// and walks up its parents until one owns a window: claude -> shell -> Windows Terminal / VS Code.
import { execFile } from 'child_process'

const MAX_HOPS = 10

const WINDOWS_SCRIPT = (pid: number): string => `
$id = ${pid}
$shell = New-Object -ComObject WScript.Shell
for ($i = 0; $i -lt ${MAX_HOPS} -and $id; $i++) {
  $p = Get-Process -Id $id -ErrorAction SilentlyContinue
  if ($p -and $p.MainWindowHandle -ne 0 -and $shell.AppActivate($p.Id)) { exit 0 }
  $id = (Get-CimInstance Win32_Process -Filter "ProcessId=$id").ParentProcessId
}
exit 1`

const MAC_SCRIPT = (pid: number): string => `
id=${pid}
for i in $(seq 1 ${MAX_HOPS}); do
  osascript -e "tell application \\"System Events\\" to set frontmost of (first process whose unix id is $id) to true" 2>/dev/null && exit 0
  id=$(ps -o ppid= -p "$id" | tr -d ' ')
  [ -z "$id" ] || [ "$id" -le 1 ] && exit 1
done
exit 1`

const LINUX_SCRIPT = (pid: number): string => `
id=${pid}
for i in $(seq 1 ${MAX_HOPS}); do
  win=$(xdotool search --pid "$id" 2>/dev/null | head -n 1)
  [ -n "$win" ] && xdotool windowactivate "$win" && exit 0
  id=$(ps -o ppid= -p "$id" | tr -d ' ')
  [ -z "$id" ] || [ "$id" -le 1 ] && exit 1
done
exit 1`

/** Never throws; silently does nothing when the window can't be found. */
export function focusAgentWindow(pid: number): void {
  if (!Number.isInteger(pid) || pid <= 1) return
  const ignore = (): void => {}
  if (process.platform === 'win32') {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_SCRIPT(pid)],
      { windowsHide: true, timeout: 5000 },
      ignore
    )
  } else {
    const script = process.platform === 'darwin' ? MAC_SCRIPT(pid) : LINUX_SCRIPT(pid)
    execFile('/bin/sh', ['-c', script], { timeout: 5000 }, ignore)
  }
}
