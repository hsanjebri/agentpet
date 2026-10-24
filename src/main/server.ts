// Local event server: the hook script POSTs agent events, usage and permission requests here.
// Binds to 127.0.0.1 only, rejects non-loopback and browser requests, and caps body size.
import { mkdirSync, writeFileSync } from 'fs'
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'http'
import { homedir } from 'os'
import { dirname, join } from 'path'
import {
  type PermissionDecision,
  type PermissionPrompt,
  type PetEvent,
  type UsageInfo,
  parsePermissionRequest,
  parsePetEvent,
  parseUsage
} from '../shared/events'

export const DEFAULT_PORT = 7777
const PORT_ATTEMPTS = 11 // 7777–7787
const MAX_BODY_BYTES = 64 * 1024
/** Where the chosen port is written, for the hook script to find. */
export const SERVER_FILE = join(homedir(), '.agentpet', 'server.json')

export type PermissionInfo = Omit<PermissionPrompt, 'id' | 'createdAt'>

export interface ServerHandlers {
  onEvent(event: PetEvent): void
  onUsage(usage: UsageInfo): void
  /** Resolves with the user's decision, or null to let the agent ask in its own window. */
  onPermission(info: PermissionInfo, cancelled: AbortSignal): Promise<PermissionDecision | null>
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

function readJson(req: IncomingMessage): Promise<unknown> {
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
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new HttpError(400, 'invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function reply(res: ServerResponse, status: number, body?: unknown): void {
  if (res.writableEnded) return
  if (body === undefined) {
    res.writeHead(status).end()
  } else {
    res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
  }
}

async function route(
  handlers: ServerHandlers,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) throw new HttpError(403, 'local only')
  // Browsers always send Origin on cross-site requests; hooks never do. Blocks web pages
  // from poking the pet.
  if (req.headers.origin) throw new HttpError(403, 'no browsers')

  const path = (req.url ?? '/').split('?')[0]
  if (req.method === 'GET' && path === '/health')
    return reply(res, 200, { ok: true, app: 'agentpet' })
  if (req.method !== 'POST') throw new HttpError(404, 'not found')

  if (path === '/event') {
    const event = parsePetEvent(await readJson(req))
    if (!event) throw new HttpError(400, 'invalid event')
    handlers.onEvent(event)
    return reply(res, 204)
  }
  if (path === '/usage') {
    const usage = parseUsage(await readJson(req))
    if (!usage) throw new HttpError(400, 'invalid usage')
    handlers.onUsage(usage)
    return reply(res, 204)
  }
  if (path === '/permission') {
    const info = parsePermissionRequest(await readJson(req))
    if (!info) throw new HttpError(400, 'invalid permission request')
    // the hook gave up (timeout, or the agent moved on): stop waiting for the user
    const cancel = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) cancel.abort()
    })
    const decision = await handlers.onPermission(info, cancel.signal)
    return reply(res, 200, { decision })
  }
  throw new HttpError(404, 'not found')
}

export function createAgentServer(handlers: ServerHandlers): Server {
  return createServer((req, res) => {
    route(handlers, req, res).catch((err: unknown) => {
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

/** Starts on 7777, or the next free port up to 7787, and records the port for the hooks. */
export async function startAgentServer(
  handlers: ServerHandlers,
  { firstPort = DEFAULT_PORT, portFile = SERVER_FILE as string | null } = {}
): Promise<{ server: Server; port: number }> {
  const server = createAgentServer(handlers)
  for (let port = firstPort; port < firstPort + PORT_ATTEMPTS; port++) {
    if (await listen(server, port)) {
      if (portFile) {
        mkdirSync(dirname(portFile), { recursive: true })
        writeFileSync(portFile, JSON.stringify({ port, pid: process.pid }))
      }
      return { server, port }
    }
  }
  throw new Error(`no free port between ${firstPort} and ${firstPort + PORT_ATTEMPTS - 1}`)
}
