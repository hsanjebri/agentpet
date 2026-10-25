// IPC channel names and the API the preload script exposes to the renderer.
import type {
  PermissionDecision,
  PermissionPrompt,
  PetEvent,
  SessionSummary,
  UsageInfo
} from './events'
import type { SkinId } from './skins'

export const IPC = {
  setInteractive: 'pet:set-interactive',
  dragStart: 'pet:drag-start',
  dragEnd: 'pet:drag-end',
  settings: 'pet:settings',
  getSettings: 'pet:get-settings',
  agentEvent: 'pet:agent-event',
  usage: 'pet:usage',
  permissions: 'pet:permissions',
  decide: 'pet:decide',
  session: 'pet:session',
  setAlert: 'pet:set-alert',
  petClicked: 'pet:clicked',
  connectStatus: 'pet:connect-status',
  connect: 'pet:connect',
  closeWindow: 'pet:close-window'
} as const

export interface ConnectStatus {
  connected: boolean
  settingsPath: string
  /** the JSON AgentPet adds, shown before connecting */
  preview: string
  /** the hooks run with Node; null when `node` isn't installed / on PATH */
  nodeVersion: string | null
}

export interface ConnectResult {
  ok: boolean
  backupPath?: string
  error?: string
}

export interface DragResult {
  /** false when the pointer barely moved, i.e. the drag was really a click */
  moved: boolean
}

/** The settings the renderer needs to know about. */
export interface PetSettings {
  skin: SkinId
  muted: boolean
  /** hide the pet unless it needs you, hisses or is sad */
  focusMode: boolean
  /** cycling through every mood (tray › Mood demo); not saved */
  demo: boolean
}

export interface PetApi {
  /** true = the window catches the mouse, false = clicks pass through to apps below */
  setInteractive(interactive: boolean): void
  dragStart(): void
  dragEnd(): Promise<DragResult>
  getSettings(): Promise<PetSettings>
  /** Called whenever settings change (e.g. from the tray). Returns an unsubscribe function. */
  onSettings(listener: (settings: PetSettings) => void): () => void
  /** Events from the coding agent (via the hooks). Returns an unsubscribe function. */
  onAgentEvent(listener: (event: PetEvent) => void): () => void
  onUsage(listener: (usage: UsageInfo) => void): () => void
  /** The permission requests currently waiting for a click (oldest first). */
  onPermissions(listener: (prompts: PermissionPrompt[]) => void): () => void
  decide(id: string, decision: PermissionDecision): void
  /** The session the pet is following (for the hover bubble). */
  onSession(listener: (session: SessionSummary | null) => void): () => void
  /** Needs-you alert on/off: the pet hops toward the screen center and back. */
  setAlert(on: boolean): void
  /** A click (not a drag): bring the agent's terminal to the front. */
  petClicked(): void
  connectStatus(): Promise<ConnectStatus>
  connect(): Promise<ConnectResult>
  closeWindow(): void
}
