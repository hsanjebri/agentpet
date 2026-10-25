// Connects Claude Code to AgentPet: merges our hooks + status line into ~/.claude/settings.json.
//   node scripts/install-hooks.mjs            install (backs the file up first)
//   node scripts/install-hooks.mjs --dry-run  only show what would be added
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { agentPetEntries } from './claude-hooks.mjs'
import { SETTINGS_PATH, connect } from './claude-settings.mjs'

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'cli', 'agentpet-send.mjs')

console.log(`AgentPet will add to ${SETTINGS_PATH}:\n`)
console.log(JSON.stringify(agentPetEntries(CLI), null, 2))

if (process.argv.includes('--dry-run')) {
  console.log('\n(dry run: nothing was changed)')
  process.exit(0)
}

const { backupPath, keptStatusLine } = connect(CLI)
if (backupPath) console.log(`\nBackup: ${backupPath}`)
if (keptStatusLine) console.log('Your status line is kept: AgentPet runs it and shows its output.')
console.log('Done. Restart Claude Code (or start a new session) to connect it to AgentPet.')
