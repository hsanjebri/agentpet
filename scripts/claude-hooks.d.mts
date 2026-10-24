// Types for claude-hooks.mjs (used by the tests).
type Settings = Record<string, unknown>

export const MARK: string
export const EVENT_HOOKS: string[]
export const PERMISSION_TIMEOUT_S: number
export function isOurStatusLine(statusLine: unknown): boolean
export function agentPetEntries(cliPath: string): { hooks: Settings; statusLine: Settings }
export function removeAgentPet(settings: Settings): Settings
export function addAgentPet(settings: Settings, cliPath: string): Settings
