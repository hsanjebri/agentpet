// Finds who is on the other end of a local connection: the hook's curl, then its parent (the
// agent), for click-to-focus. curl can't say who started it, so the app asks the OS while the
// connection is still open. Best effort: resolves null when it can't tell.
import { execFile } from 'child_process'

const TIMEOUT_MS = 4000

// netstat finds curl in ~0.1 s; Get-NetTCPConnection would add ~2 s of module loading
const WINDOWS_PARENT = (pid: number): string =>
  `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").ParentProcessId`

// ss (Linux) names the process owning the local port; lsof (macOS, some Linux) lists both ends,
// so skip ourselves
const UNIX_SCRIPT = (clientPort: number, self: number): string => `
pid=$(ss -Htnp "sport = :${clientPort}" 2>/dev/null | grep -o 'pid=[0-9]*' | head -n 1 | cut -d= -f2)
[ -z "$pid" ] && pid=$(lsof -nP -iTCP:${clientPort} -sTCP:ESTABLISHED -Fp 2>/dev/null | sed -n 's/^p//p' | grep -vx ${self} | head -n 1)
[ -n "$pid" ] && ps -o ppid= -p "$pid" | tr -d ' '`

function run(file: string, args: string[]): Promise<string> {
  return new Promise((resolve) =>
    execFile(file, args, { windowsHide: true, timeout: TIMEOUT_MS }, (err, stdout) =>
      resolve(err ? '' : stdout)
    )
  )
}

function asPid(text: string | undefined): number | null {
  const pid = Number.parseInt(text?.trim() ?? '', 10)
  return pid > 1 ? pid : null
}

/** The PID owning 127.0.0.1:clientPort -> 127.0.0.1:serverPort, from `netstat -ano` output. */
export function pidFromNetstat(
  netstat: string,
  clientPort: number,
  serverPort: number
): number | null {
  const line = netstat
    .split(/\r?\n/)
    .map((l) => l.trim().split(/\s+/))
    .find(
      ([proto, local, remote]) =>
        proto === 'TCP' && local?.endsWith(`:${clientPort}`) && remote?.endsWith(`:${serverPort}`)
    )
  return asPid(line?.[4])
}

/** The parent of the process connected from `clientPort` to our `serverPort`. */
export async function agentPidOfPeer(
  clientPort: number,
  serverPort: number
): Promise<number | null> {
  if (process.platform !== 'win32')
    return asPid(await run('/bin/sh', ['-c', UNIX_SCRIPT(clientPort, process.pid)]))
  const curl = pidFromNetstat(await run('netstat', ['-ano', '-p', 'TCP']), clientPort, serverPort)
  if (!curl) return null
  return asPid(
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_PARENT(curl)])
  )
}
