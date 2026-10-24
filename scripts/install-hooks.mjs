// Connects Claude Code to AgentPet: merges our hooks + status line into ~/.claude/settings.json.
//   node scripts/install-hooks.mjs            install (backs the file up first)
//   node scripts/install-hooks.mjs --dry-run  only show what would be added
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addAgentPet, agentPetEntries, isOurStatusLine } from './claude-hooks.mjs'

const SETTINGS = join(homedir(), '.claude', 'settings.json')
const CONFIG = join(homedir(), '.agentpet', 'config.json')
const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'cli', 'agentpet-send.mjs')

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

const dryRun = process.argv.includes('--dry-run')
const settings = readJson(SETTINGS, {})

console.log(`AgentPet will add to ${SETTINGS}:\n`)
console.log(JSON.stringify(agentPetEntries(CLI), null, 2))

if (settings.statusLine && !isOurStatusLine(settings.statusLine)) {
  console.log('\nYour current status line is kept: AgentPet runs it and shows its output.')
}

if (dryRun) {
  console.log('\n(dry run: nothing was changed)')
  process.exit(0)
}

if (existsSync(SETTINGS)) {
  const backup = `${SETTINGS}.agentpet-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`
  copyFileSync(SETTINGS, backup)
  console.log(`\nBackup: ${backup}`)
}

// remember the user's own status line so the hook can keep showing it, and uninstall can
// put it back
if (settings.statusLine && !isOurStatusLine(settings.statusLine)) {
  mkdirSync(dirname(CONFIG), { recursive: true })
  writeFileSync(
    CONFIG,
    JSON.stringify({ ...readJson(CONFIG, {}), previousStatusLine: settings.statusLine }, null, 2)
  )
}

mkdirSync(dirname(SETTINGS), { recursive: true })
writeFileSync(SETTINGS, JSON.stringify(addAgentPet(settings, CLI), null, 2) + '\n')
console.log('Done. Restart Claude Code (or start a new session) to connect it to AgentPet.')
