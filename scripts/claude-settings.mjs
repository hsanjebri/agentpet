// Reads and writes ~/.claude/settings.json for AgentPet. Used by the npm scripts and the app's
// "Connect Claude Code" screen. Always backs the file up before changing it.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  addAgentPet,
  hasAgentPet,
  isCurrent,
  isOurStatusLine,
  removeAgentPet
} from './claude-hooks.mjs'

export const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json')
export const CONFIG_PATH = join(homedir(), '.agentpet', 'config.json')
/** curl config the hooks read (app address + token), written by the app on every start. */
export const CURL_CONFIG_PATH = join(homedir(), '.agentpet', 'agentpet-send.curl')

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
}

function backup(path) {
  if (!existsSync(path)) return undefined
  const stamp = `${path}.agentpet-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`
  // two backups in the same millisecond must not overwrite each other
  let copy = stamp
  for (let n = 2; existsSync(copy); n++) copy = `${stamp}-${n}`
  copyFileSync(path, copy)
  return copy
}

export function isConnected({ settingsPath = SETTINGS_PATH } = {}) {
  try {
    return hasAgentPet(readJson(settingsPath, {}))
  } catch {
    return false
  }
}

/** True when Claude Code holds exactly the hooks this version writes. */
export function isUpToDate(
  curlConfigPath = CURL_CONFIG_PATH,
  { settingsPath = SETTINGS_PATH } = {}
) {
  try {
    return isCurrent(readJson(settingsPath, {}), curlConfigPath)
  } catch {
    return false
  }
}

/** The status line the user had before AgentPet, if any (AgentPet keeps showing it). */
export function previousStatusLine({ configPath = CONFIG_PATH } = {}) {
  try {
    const command = readJson(configPath, {}).previousStatusLine?.command
    return typeof command === 'string' && command ? command : undefined
  } catch {
    return undefined
  }
}

/**
 * Brings an older install up to date (e.g. the Node hooks before 0.4.1 -> curl). Does nothing
 * when Claude Code isn't connected or already current. Returns the backup path when it changed.
 */
export function upgrade(
  curlConfigPath = CURL_CONFIG_PATH,
  { settingsPath = SETTINGS_PATH, configPath = CONFIG_PATH } = {}
) {
  let settings
  try {
    settings = readJson(settingsPath, {})
  } catch {
    return { upgraded: false } // unreadable: leave the user's file alone
  }
  if (!hasAgentPet(settings) || isCurrent(settings, curlConfigPath)) return { upgraded: false }
  return { upgraded: true, ...connect(curlConfigPath, { settingsPath, configPath }) }
}

/** Adds AgentPet's hooks + status line. Returns the backup path (if there was a file). */
export function connect(
  curlConfigPath = CURL_CONFIG_PATH,
  { settingsPath = SETTINGS_PATH, configPath = CONFIG_PATH } = {}
) {
  const settings = readJson(settingsPath, {})
  const backupPath = backup(settingsPath)
  // remember the user's own status line: the hook keeps showing it, disconnect puts it back
  if (settings.statusLine && !isOurStatusLine(settings.statusLine)) {
    writeJson(configPath, { ...readJson(configPath, {}), previousStatusLine: settings.statusLine })
  }
  writeJson(settingsPath, addAgentPet(settings, curlConfigPath))
  return {
    backupPath,
    keptStatusLine: Boolean(settings.statusLine && !isOurStatusLine(settings.statusLine))
  }
}

/** Removes only AgentPet's entries and restores the previous status line. */
export function disconnect({ settingsPath = SETTINGS_PATH, configPath = CONFIG_PATH } = {}) {
  if (!existsSync(settingsPath)) return { backupPath: undefined }
  const backupPath = backup(settingsPath)
  const next = removeAgentPet(readJson(settingsPath, {}))
  const config = readJson(configPath, {})
  if (config.previousStatusLine && !next.statusLine) {
    next.statusLine = config.previousStatusLine
    delete config.previousStatusLine
    writeJson(configPath, config)
  }
  writeJson(settingsPath, next)
  return { backupPath }
}
