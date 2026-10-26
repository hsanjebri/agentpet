// Connects Claude Code to AgentPet: merges our hooks + status line into ~/.claude/settings.json.
//   node scripts/install-hooks.mjs            install (backs the file up first)
//   node scripts/install-hooks.mjs --dry-run  only show what would be added
// The hooks are curl calls; the running app writes the curl config they read.
import { agentPetEntries } from './claude-hooks.mjs'
import { CURL_CONFIG_PATH, SETTINGS_PATH, connect } from './claude-settings.mjs'

console.log(`AgentPet will add to ${SETTINGS_PATH}:\n`)
console.log(JSON.stringify(agentPetEntries(CURL_CONFIG_PATH), null, 2))

if (process.argv.includes('--dry-run')) {
  console.log('\n(dry run: nothing was changed)')
  process.exit(0)
}

const { backupPath, keptStatusLine } = connect(CURL_CONFIG_PATH)
if (backupPath) console.log(`\nBackup: ${backupPath}`)
if (keptStatusLine) console.log('Your status line is kept: AgentPet runs it and shows its output.')
console.log('Done. Restart Claude Code (or start a new session) to connect it to AgentPet.')
