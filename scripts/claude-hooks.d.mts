// Types for claude-hooks.mjs (used by the tests).
type Settings = Record<string, unknown>

export const MARK: string
export const EVENT_HOOKS: string[]
export const PERMISSION_TIMEOUT_S: number
export function isOurStatusLine(statusLine: unknown): boolean
export function agentPetEntries(
  curlConfigPath: string,
  platform?: string
): { hooks: Settings; statusLine: { type: string; command: string } }
export function isCurrent(settings: Settings, curlConfigPath: string, platform?: string): boolean
export function removeAgentPet(settings: Settings): Settings
export function addAgentPet(settings: Settings, curlConfigPath: string, platform?: string): Settings
export function hasAgentPet(settings: Settings): boolean
