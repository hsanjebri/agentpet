import { spawn } from 'child_process'
import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { describe, expect, it } from 'vitest'
import { agentPidOfPeer, pidFromNetstat } from '../src/main/peerPid'

describe('peer process lookup (click-to-focus with curl hooks)', () => {
  it('reads the client end of the connection from netstat', () => {
    const netstat = [
      '  Proto  Local Address          Foreign Address        State           PID',
      '  TCP    127.0.0.1:7777         127.0.0.1:51234        ESTABLISHED     900',
      '  TCP    127.0.0.1:51234        127.0.0.1:7777         ESTABLISHED     4242',
      '  TCP    127.0.0.1:51235        127.0.0.1:7777         ESTABLISHED     5555'
    ].join('\r\n')
    expect(pidFromNetstat(netstat, 51234, 7777)).toBe(4242)
    expect(pidFromNetstat(netstat, 1, 7777)).toBeNull()
  })

  it('finds the parent of a real curl (here: this test process)', async () => {
    const found = await new Promise<number | null>((resolve) => {
      const server = createServer((req, res) => {
        agentPidOfPeer(req.socket.remotePort!, req.socket.localPort!).then((pid) => {
          res.end()
          server.close()
          resolve(pid)
        })
      })
      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as AddressInfo).port
        spawn('curl', [
          '-s',
          '-m',
          '10',
          '--data-binary',
          '@-',
          `http://127.0.0.1:${port}/`
        ]).stdin.end('{}')
      })
    })
    expect(found).toBe(process.pid)
  }, 15_000)
})
