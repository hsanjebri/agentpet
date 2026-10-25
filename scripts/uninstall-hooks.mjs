// Disconnects Claude Code from AgentPet: removes only our entries from ~/.claude/settings.json
// and puts back the status line the user had before.
import { SETTINGS_PATH, disconnect } from './claude-settings.mjs'

const { backupPath } = disconnect()
console.log(
  backupPath
    ? `Removed AgentPet from ${SETTINGS_PATH} (backup: ${backupPath}).`
    : 'No Claude Code settings found; nothing to do.'
)
