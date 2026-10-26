// Local event server: Claude Code's hooks POST their raw JSON here with curl (agent events,
// permission requests, status line). Binds to 127.0.0.1 only, needs the token from the curl
// config, rejects browser requests, and caps body size.
import { randomBytes, timingSafeEqual } from 'crypto'
import { chmodSync, mkdirSync, writeFileSync } from 'fs'
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'http'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { CURL_CONFIG_PATH } from '../../scripts/claude-settings.mjs'
import type { PermissionDecision, PermissionPrompt, PetEvent, UsageInfo } from '../shared/events'
import {
  HOOK_MODES,
  type HookMode,
  eventFromHook,
  permissionFromHook,
  permissionOutput,
  statusLineText,
  usageFromStatusLine
} from './hookInput'
import { agentPidOfPeer } from './peerPid'

export const DEFAULT_PORT = 7777
const PORT_ATTEMPTS = 11 // 7777–7787
const MAX_BODY_BYTES = 64 * 1024
/** Where the chosen port is written. */
export const SERVER_FILE = join(homedir(), '.agentpet', 'server.json')
/** Header the hook commands use to say which hook they are. */
export const HOOK_HEADER = 'x-agentpet-hook'

export type PermissionInfo = Omit<PermissionPrompt, 'id' | 'createdAt'>

export interface ServerHandlers {
  onEvent(event: PetEvent): void
  onUsage(usage: UsageInfo): void
  /** Resolves with the user's decision, or null to let the agent ask in its own window. */
  onPermission(info: PermissionInfo, cancelled: AbortSignal): Promise<PermissionDecision | null>
  /** The status line text (default: AgentPet's own). `raw` is what Claude Code sent. */
  statusLine?(raw: string, usage: UsageInfo): Promise<string>
  /** True when the session's agent process isn't known yet (for click-to-focus). */
  wantsPid?(sessionId: string): boolean
  onAgentPid?(sessionId: string, pid: number): void
}

export interface ServerOptions {
  /** Hooks must send it as `Authorization: Bearer <token>`. */
  token: string
  findAgentPid?: (clientPort: number, serverPort: number) => Promise<number | null>
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      // too big: keep reading (and dropping) so the client still gets a proper 413;
      // only cut off clients that keep going far past the limit
      if (size <= MAX_BODY_BYTES) chunks.push(chunk)
      else if (size > 16 * MAX_BODY_BYTES) req.destroy()
    })
    req.on('end', () => {
      if (size > MAX_BODY_BYTES) return reject(new HttpError(413, 'body too large'))
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
  })
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'invalid JSON')
  }
}

function reply(res: ServerResponse, status: number, body?: unknown): void {
  if (res.writableEnded) return
  if (body === undefined) {
    res.writeHead(status).end()
  } else {
    res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
  }
}

/** curl prints the body as is: the status line, or Claude Code's permission answer. */
function replyText(res: ServerResponse, text: string): void {
  if (res.writableEnded) return
  if (!text) return void res.writeHead(204).end()
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(text)
}

function authorized(req: IncomingMessage, token: string): boolean {
  const given = Buffer.from(req.headers.authorization ?? '')
  const expected = Buffer.from(`Bearer ${token}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export function createAgentServer(handlers: ServerHandlers, options: ServerOptions): Server {
  const findAgentPid = options.findAgentPid ?? agentPidOfPeer
  const lookingUp = new Set<string>()

  /** Asks the OS who sent this request, once per session, while curl is still connected. */
  async function learnPid(req: IncomingMessage, sessionId: string | undefined): Promise<void> {
    if (!sessionId || !handlers.wantsPid?.(sessionId) || lookingUp.has(sessionId)) return
    const { remotePort, localPort } = req.socket
    if (!remotePort || !localPort) return
    lookingUp.add(sessionId)
    try {
      const pid = await findAgentPid(remotePort, localPort)
      if (pid) handlers.onAgentPid?.(sessionId, pid)
    } finally {
      lookingUp.delete(sessionId)
    }
  }

  async function hook(mode: HookMode, req: IncomingMessage, res: ServerResponse): Promise<void> {
    const raw = await readBody(req)
    const input = parseJson(raw)

    if (mode === 'statusline') {
      const usage = usageFromStatusLine(input)
      handlers.onUsage(usage)
      const text = handlers.statusLine
        ? await handlers.statusLine(raw, usage)
        : statusLineText(usage)
      return replyText(res, text)
    }
    if (mode === 'permission') {
      const info = permissionFromHook('claude-code', input)
      if (!info) throw new HttpError(400, 'invalid permission request')
      // the hook gave up (timeout, or the agent moved on): stop waiting for the user
      const cancel = new AbortController()
      res.on('close', () => {
        if (!res.writableEnded) cancel.abort()
      })
      const decision = handlers.onPermission(info, cancel.signal)
      learnPid(req, info.sessionId).catch(() => {})
      return replyText(res, permissionOutput(await decision))
    }
    const event = eventFromHook('claude-code', input)
    if (event) handlers.onEvent(event)
    // event hooks run async, so Claude Code doesn't wait for this
    await learnPid(req, event?.sessionId).catch(() => {})
    return reply(res, 204)
  }

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) throw new HttpError(403, 'local only')
    // Browsers always send Origin on cross-site requests; hooks never do. Blocks web pages
    // from poking the pet.
    if (req.headers.origin) throw new HttpError(403, 'no browsers')

    const path = (req.url ?? '/').split('?')[0]
    if (req.method === 'GET' && path === '/health')
      return reply(res, 200, { ok: true, app: 'agentpet' })
    if (req.method !== 'POST' || path !== '/hook') throw new HttpError(404, 'not found')
    if (!authorized(req, options.token)) throw new HttpError(401, 'bad token')

    const mode = req.headers[HOOK_HEADER] as HookMode
    if (!HOOK_MODES.includes(mode)) throw new HttpError(400, 'unknown hook')
    return hook(mode, req, res)
  }

  return createServer((req, res) => {
    route(req, res).catch((err: unknown) => {
      const status = err instanceof HttpError ? err.status : 500
      reply(res, status, { error: err instanceof Error ? err.message : 'error' })
    })
  })
}

function listen(server: Server, port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException): void => {
      server.off('listening', onListening)
      if (err.code === 'EADDRINUSE') resolve(false)
      else reject(err)
    }
    const onListening = (): void => {
      server.off('error', onError)
      resolve(true)
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, '127.0.0.1')
  })
}

/** What the hook commands pass to curl with -K: where the app is, and its token. */
export function curlConfig(port: number, token: string): string {
  return [
    "# AgentPet: how Claude Code's hooks reach the app. Rewritten every time AgentPet starts.",
    `url = "http://127.0.0.1:${port}/hook"`,
    `header = "Authorization: Bearer ${token}"`,
    // quiet, and no output on errors: Claude Code then carries on as if the pet weren't there
    'silent',
    'fail',
    'connect-timeout = 1',
    ''
  ].join('\n')
}

function writePrivate(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text, { mode: 0o600 })
  chmodSync(path, 0o600)
}

/**
 * Starts on 7777, or the next free port up to 7787, with a fresh token, and writes both into
 * the curl config the hooks read.
 */
export async function startAgentServer(
  handlers: ServerHandlers,
  {
    firstPort = DEFAULT_PORT,
    portFile = SERVER_FILE as string | null,
    curlConfigFile = CURL_CONFIG_PATH as string | null
  } = {}
): Promise<{ server: Server; port: number; token: string }> {
  const token = randomBytes(24).toString('hex')
  const server = createAgentServer(handlers, { token })
  for (let port = firstPort; port < firstPort + PORT_ATTEMPTS; port++) {
    if (await listen(server, port)) {
      if (portFile) writePrivate(portFile, JSON.stringify({ port, pid: process.pid }))
      if (curlConfigFile) writePrivate(curlConfigFile, curlConfig(port, token))
      return { server, port, token }
    }
  }
  throw new Error(`no free port between ${firstPort} and ${firstPort + PORT_ATTEMPTS - 1}`)
}
