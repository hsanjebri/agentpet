import type { PetEvent } from '@shared/events'
import { describe, expect, it } from 'vitest'
import { MANY_FILES, RiskWatcher, riskOf } from '../src/main/risk'

describe('riskOf', () => {
  it.each([
    ['Edit', 'C:\\proj\\.env', 'touching .env'],
    ['Write', '/proj/.env.local', 'touching .env.local'],
    ['Edit', '/proj/config/secrets.json', 'touching secrets.json'],
    ['Write', '/home/me/.ssh/id_rsa', 'touching id_rsa'],
    ['Edit', '/proj/certs/server.pem', 'touching server.pem'],
    ['Bash', 'rm -rf node_modules dist', 'rm -rf'],
    ['Bash', 'rm -fr build', 'rm -rf'],
    ['Bash', 'git push --force origin main', 'git push --force'],
    ['Bash', 'git push -f', 'git push --force'],
    ['Bash', 'psql -c "DROP TABLE users"', 'DROP TABLE'],
    ['Bash', 'chmod -R 777 /var/www', 'chmod 777'],
    ['Bash', 'rm src/auth.test.ts', 'deleting tests'],
    ['PowerShell', 'Remove-Item tests/old -Recurse', 'deleting tests'],
    ['Bash', 'cat .env', 'reading secrets']
  ])('%s %s -> %s', (tool, target, reason) => {
    expect(riskOf(tool, target)).toBe(reason)
  })

  it.each([
    ['Edit', '/proj/src/environment.ts'],
    ['Read', '/proj/.env'], // reading through the Read tool is normal
    ['Bash', 'npm test'],
    ['Bash', 'rm dist/bundle.js'],
    ['Bash', 'git push origin main'],
    ['Edit', '/proj/src/App.test.tsx'] // editing a test is fine, deleting it is not
  ])('%s %s is fine', (tool, target) => {
    expect(riskOf(tool, target)).toBeNull()
  })
})

describe('RiskWatcher', () => {
  const edit = (file: string, sessionId = 's1'): PetEvent => ({
    type: 'tool',
    agent: 'claude-code',
    sessionId,
    toolName: 'Edit',
    target: file,
    timestamp: 0
  })

  it(`warns once when more than ${MANY_FILES} files change in one turn`, () => {
    const watcher = new RiskWatcher()
    const reasons = Array.from({ length: MANY_FILES + 3 }, (_, i) =>
      watcher.check(edit(`f${i}.ts`))
    )
    expect(reasons.filter(Boolean)).toEqual([`${MANY_FILES + 1} files changed in one go`])
  })

  it('counts each file once and starts over on a new prompt', () => {
    const watcher = new RiskWatcher()
    for (let i = 0; i < 40; i++) expect(watcher.check(edit('same.ts'))).toBeNull()
    for (let i = 0; i < MANY_FILES; i++) watcher.check(edit(`f${i}.ts`))
    watcher.check({ type: 'working', agent: 'claude-code', sessionId: 's1', timestamp: 0 })
    expect(watcher.check(edit('another.ts'))).toBeNull()
  })

  it('keeps sessions apart', () => {
    const watcher = new RiskWatcher()
    for (let i = 0; i < MANY_FILES; i++) watcher.check(edit(`a${i}.ts`, 'a'))
    expect(watcher.check(edit('b0.ts', 'b'))).toBeNull()
  })
})
