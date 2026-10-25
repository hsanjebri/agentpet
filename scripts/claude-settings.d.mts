// Types for claude-settings.mjs (used by the app's main process and the tests).
interface Paths {
  settingsPath?: string
  configPath?: string
}

export const SETTINGS_PATH: string
export const CONFIG_PATH: string
export function isConnected(paths?: Paths): boolean
export function connect(
  cliPath: string,
  paths?: Paths
): { backupPath: string | undefined; keptStatusLine: boolean }
export function disconnect(paths?: Paths): { backupPath: string | undefined }
