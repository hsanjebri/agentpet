// Types for claude-settings.mjs (used by the app's main process and the tests).
interface Paths {
  settingsPath?: string
  configPath?: string
}

export const SETTINGS_PATH: string
export const CONFIG_PATH: string
export const CURL_CONFIG_PATH: string
export function isConnected(paths?: Paths): boolean
export function claudeFound(paths?: Paths): boolean
export function listBackups(paths?: Paths): string[]
export function restoreLatestBackup(paths?: Paths): {
  restored: string | undefined
  backupPath?: string
}
export function isUpToDate(curlConfigPath?: string, paths?: Paths): boolean
export function previousStatusLine(paths?: Paths): string | undefined
export function connect(
  curlConfigPath?: string,
  paths?: Paths
): { backupPath: string | undefined; keptStatusLine: boolean }
export function upgrade(
  curlConfigPath?: string,
  paths?: Paths
): { upgraded: boolean; backupPath?: string }
export function disconnect(paths?: Paths): { backupPath: string | undefined }
