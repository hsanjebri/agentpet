import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { PetEvent } from '@shared/events'
import { describe, expect, it } from 'vitest'
import { connect, disconnect, isConnected } from '../scripts/claude-settings.mjs'
import { SessionTracker, describeAction } from '../src/main/sessions'

const ev = (partial: Partial<PetEvent>): PetEvent => ({
  type: 'tool',
  agent: 'claude-code',
  sessionId: 's1',
  timestamp: 0,
  ...partial
})

describe('describeAction', () => {
  it('turns tool calls into a few words', () => {
    expect(describeAction('Edit', 'C:\\proj\\src\\App.tsx')).toBe('editing App.tsx')
    expect(describeAction('Read', '/proj/README.md')).toBe('reading README.md')
    expect(describeAction('Bash', 'npm test -- --watch=false --run')).toBe('running npm test --')
    expect(describeAction('Grep')).toBe('searching the code')
    expect(describeAction('mcp__thing')).toBe('using mcp__thing')
    expect(describeAction()).toBeUndefined()
  })
})

describe('SessionTracker', () => {
  it('counts tools, remembers the last action, project and pid', () => {
    const tracker = new SessionTracker()
    tracker.update(ev({ type: 'working', cwd: 'C:\\code\\my-app', pid: 42 }), 1000)
    tracker.update(ev({ toolName: 'Edit', target: '/x/App.tsx' }), 2000)
    tracker.update(ev({ toolName: 'Bash', target: 'npm test' }), 3000)
    expect(tracker.latest()).toEqual({
      sessionId: 's1',
      project: 'my-app',
      lastAction: 'running npm test',
      toolCount: 2,
      startedAt: 1000
    })
    expect(tracker.pidFor('s1')).toBe(42)
  })

  it('follows the most recently active session and forgets ended ones', () => {
    const tracker = new SessionTracker()
    tracker.update(ev({ sessionId: 'a', pid: 1 }), 1000)
    tracker.update(ev({ sessionId: 'b', pid: 2 }), 2000)
    expect(tracker.pidFor()).toBe(2)
    tracker.update(ev({ sessionId: 'b', type: 'session_end' }), 3000)
    expect(tracker.latest()?.sessionId).toBe('a')
  })

  it('forgets sessions quiet for an hour', () => {
    const tracker = new SessionTracker()
    tracker.update(ev({ sessionId: 'old' }), 0)
    tracker.update(ev({ sessionId: 'new' }), 61 * 60_000)
    tracker.update(ev({ sessionId: 'new' }), 61 * 60_000 + 1)
    expect(tracker.pidFor('old')).toBeUndefined()
    expect(tracker.latest()?.sessionId).toBe('new')
  })
})

describe('connect / disconnect (on a temp settings file)', () => {
  const setup = (): { settingsPath: string; configPath: string; dir: string } => {
    const dir = mkdtempSync(join(tmpdir(), 'agentpet-'))
    return { dir, settingsPath: join(dir, 'settings.json'), configPath: join(dir, 'config.json') }
  }

  it('connects with a backup, keeps and restores the user’s status line', () => {
    const paths = setup()
    const original = { theme: 'dark', statusLine: { type: 'command', command: 'my-line.sh' } }
    writeFileSync(paths.settingsPath, JSON.stringify(original))

    const { backupPath } = connect('/x/agentpet-send.mjs', paths)
    expect(backupPath && readFileSync(backupPath, 'utf8')).toBe(JSON.stringify(original))
    expect(isConnected(paths)).toBe(true)
    expect(JSON.parse(readFileSync(paths.configPath, 'utf8')).previousStatusLine).toEqual(
      original.statusLine
    )

    disconnect(paths)
    expect(isConnected(paths)).toBe(false)
    expect(JSON.parse(readFileSync(paths.settingsPath, 'utf8'))).toEqual(original)
    expect(readdirSync(paths.dir).filter((f) => f.includes('agentpet-backup'))).toHaveLength(2)
  })

  it('works when there is no settings file yet', () => {
    const paths = setup()
    expect(isConnected(paths)).toBe(false)
    expect(connect('/x/agentpet-send.mjs', paths).backupPath).toBeUndefined()
    expect(isConnected(paths)).toBe(true)
  })
})
