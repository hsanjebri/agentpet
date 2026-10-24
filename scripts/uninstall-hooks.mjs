// Disconnects Claude Code from AgentPet: removes only our entries from ~/.claude/settings.json
// and puts back the status line the user had before.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { removeAgentPet } from './claude-hooks.mjs'

const SETTINGS = join(homedir(), '.claude', 'settings.json')
const CONFIG = join(homedir(), '.agentpet', 'config.json')

if (!existsSync(SETTINGS)) {
  console.log('No Claude Code settings found; nothing to do.')
  process.exit(0)
}

const backup = `${SETTINGS}.agentpet-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`
copyFileSync(SETTINGS, backup)

const next = removeAgentPet(JSON.parse(readFileSync(SETTINGS, 'utf8')))
const config = existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, 'utf8')) : {}
if (config.previousStatusLine && !next.statusLine) {
  next.statusLine = config.previousStatusLine
  delete config.previousStatusLine
  writeFileSync(CONFIG, JSON.stringify(config, null, 2))
}

writeFileSync(SETTINGS, JSON.stringify(next, null, 2) + '\n')
console.log(`Removed AgentPet from ${SETTINGS} (backup: ${backup}).`)
