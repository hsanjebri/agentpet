import { describe, expect, it } from 'vitest'
import {
  LONG_TASK_MS,
  type PhoneSettings,
  PingWatcher,
  defaultPhoneSettings,
  parsePhoneSettings,
  randomTopic,
  validTopic
} from '../src/main/phonePing'

const MIN = 60_000
const settings = (over: Partial<PhoneSettings> = {}): PhoneSettings => ({
  ...defaultPhoneSettings(),
  enabled: true,
  topic: 'agentpet-test1234',
  ...over
})

describe('topics and settings', () => {
  it('random topics are valid and different', () => {
    const a = randomTopic()
    expect(validTopic(a)).toBe(true)
    expect(a).not.toBe(randomTopic())
    expect(a.startsWith('agentpet-')).toBe(true)
  })

  it('rejects bad topics and non-https servers', () => {
    expect(validTopic('has space')).toBe(false)
    expect(validTopic('abc')).toBe(false)
    expect(
      parsePhoneSettings({ topic: 'agentpet-ok123', server: 'http://evil.example' })
    ).toBeNull()
    expect(parsePhoneSettings({ topic: '../x', server: 'https://ntfy.sh' })).toBeNull()
  })

  it('cleans settings: delay from the allowed list, server without trailing slash', () => {
    expect(
      parsePhoneSettings({
        enabled: true,
        topic: 'agentpet-ok123',
        server: 'https://ntfy.sh/',
        delayMin: 7
      })
    ).toEqual({
      enabled: true,
      server: 'https://ntfy.sh',
      topic: 'agentpet-ok123',
      delayMin: 2,
      details: false,
      done: false
    })
  })

  it('is off by default', () => {
    expect(defaultPhoneSettings().enabled).toBe(false)
  })
})

describe('PingWatcher', () => {
  it('pings once after the delay, not before', () => {
    const w = new PingWatcher()
    w.needs({ sessionId: 's', project: 'my-app' }, 0)
    expect(w.due(2 * MIN - 1, settings())).toEqual([])
    const [ping] = w.due(2 * MIN, settings())
    expect(ping.message).toBe('Waiting for your approval in my-app (2 min).')
    expect(ping.priority).toBe(4)
    expect(w.due(10 * MIN, settings())).toEqual([]) // only once per wait
  })

  it('keeps the start of the wait when asked again', () => {
    const w = new PingWatcher()
    w.needs({ sessionId: 's' }, 0)
    w.needs({ sessionId: 's' }, MIN)
    expect(w.due(2 * MIN, settings())).toHaveLength(1)
  })

  it('no ping when the agent carried on or the user clicked the pet', () => {
    const w = new PingWatcher()
    w.needs({ sessionId: 'a' }, 0)
    w.needs({ sessionId: 'b' }, 0)
    w.resolved('a')
    expect(w.due(5 * MIN, settings())).toHaveLength(1)
    w.needs({ sessionId: 'c' }, 0)
    w.userIsHere()
    expect(w.due(10 * MIN, settings())).toEqual([])
  })

  it('details (the command) only when allowed', () => {
    const w = new PingWatcher()
    w.needs({ sessionId: 's', tool: 'Bash', target: 'npm test' }, 0)
    expect(w.due(2 * MIN, settings())[0].message).not.toContain('npm test')
    const w2 = new PingWatcher()
    w2.needs({ sessionId: 's', tool: 'Bash', target: 'npm test' }, 0)
    expect(w2.due(2 * MIN, settings({ details: true }))[0].message).toContain('Bash: npm test')
  })

  it('a long finished task pings only when that option is on', () => {
    const w = new PingWatcher()
    w.working('s', 0)
    expect(w.done({ sessionId: 's', project: 'my-app' }, LONG_TASK_MS, settings())).toBeNull()
    w.working('s', 0)
    expect(
      w.done({ sessionId: 's', project: 'my-app' }, LONG_TASK_MS, settings({ done: true }))?.message
    ).toBe('Done in my-app after 3 min.')
    w.working('s', 0)
    expect(w.done({ sessionId: 's' }, MIN, settings({ done: true }))).toBeNull() // short task
  })
})
