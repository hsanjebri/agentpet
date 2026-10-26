// IPC channel names and the API the preload script exposes to the renderer.
import type {
  PermissionDecision,
  PermissionPrompt,
  PetEvent,
  SessionSummary,
  UsageInfo
} from './events'
import type { MusicCommand, MusicState } from './music'
import type { Accessory, PetLook, RareMoment, Recap } from './progress'
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
  closeWindow: 'pet:close-window',
  look: 'pet:look',
  getLook: 'pet:get-look',
  moment: 'pet:moment',
  walk: 'pet:walk',
  getProfile: 'pet:get-profile',
  setPetName: 'pet:set-name',
  setWearing: 'pet:set-wearing',
  saveCard: 'pet:save-card',
  copyCard: 'pet:copy-card',
  share: 'pet:share',
  music: 'music',
  musicCmd: 'music-cmd',
  setMusic: 'pet:set-music',
  getPhone: 'pet:get-phone',
  setPhone: 'pet:set-phone',
  testPhone: 'pet:test-phone',
  changeSettings: 'pet:change-settings',
  openPhone: 'pet:open-phone',
  finishSetup: 'pet:finish-setup'
} as const

/** Phone ping settings (ntfy). */
export interface PhoneSettings {
  enabled: boolean
  server: string
  topic: string
  delayMin: number
  details: boolean
  done: boolean
}

export interface PhoneResult {
  ok: boolean
  error?: string
}

/** Something to celebrate or animate right now. */
export type PetMoment =
  | { kind: 'rare'; rare: RareMoment }
  | { kind: 'level_up'; level: number }
  | { kind: 'unlocked'; item: Accessory }
  | { kind: 'fed' }
  | { kind: 'update'; version: string }
  /** first-run setup finished: say hi */
  | { kind: 'hello' }

/** The pet strolling along the bottom of the screen. */
export interface WalkState {
  walking: boolean
  facing: 'left' | 'right'
}

export interface ProfileData {
  look: PetLook
  totals: { tasks: number; approvals: number; rainbows: number }
  streak: number
  unlocks: Array<{ item: Accessory; label: string; unlocked: boolean }>
  today: Recap
  week: Recap
  lastFedAt: number | null
}

export interface ConnectStatus {
  connected: boolean
  settingsPath: string
  /** the JSON AgentPet adds, shown before connecting */
  preview: string
  /** hooks are installed but not the ones this version writes (e.g. moved or old) */
  outdated: boolean
  /** an agent event reached the app since it started: the connection really works */
  heardFromAgent: boolean
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
  /** stroll along the bottom of the screen now and then when idle */
  wander: boolean
  /** react to the music playing on the PC */
  music: boolean
  /** the music feature exists on this OS (Windows only for now) */
  musicSupported: boolean
  /** cycling through every mood (tray › Mood demo); not saved */
  demo: boolean
  /** starts with the computer (installed app only) */
  startOnLogin: boolean
  /** false in dev: registering a dev build would start a bare Electron at login */
  startOnLoginSupported: boolean
}

/** What the setup window may change. */
export type SettingsChange = Partial<Pick<PetSettings, 'skin' | 'music' | 'startOnLogin'>>

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
  getLook(): Promise<PetLook>
  onLook(listener: (look: PetLook) => void): () => void
  onMoment(listener: (moment: PetMoment) => void): () => void
  onWalk(listener: (walk: WalkState) => void): () => void
  getProfile(): Promise<ProfileData>
  setPetName(name: string): void
  setWearing(items: Accessory[]): void
  /** Asks where to save the card image; resolves with the path, or null if cancelled. */
  saveCard(pngDataUrl: string, fileName: string): Promise<string | null>
  copyCard(pngDataUrl: string): void
  /** Opens "post to X" in the browser with this text. */
  share(text: string): void
  /** What's playing on the PC (Spotify, browsers...). */
  onMusic(listener: (music: MusicState) => void): () => void
  musicCommand(command: MusicCommand): void
  setMusic(on: boolean): void
  getPhone(): Promise<PhoneSettings>
  setPhone(settings: PhoneSettings): Promise<PhoneResult>
  /** Sends a test notification with these settings (saved or not). */
  testPhone(settings: PhoneSettings): Promise<PhoneResult>
  changeSettings(change: SettingsChange): void
  openPhone(): void
  /** Ends the first-run setup: closes the window, the pet says hi. */
  finishSetup(): void
}
