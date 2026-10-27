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
import type { FriendsCommand, FriendsResult, FriendsView } from './friends'
import type { PomodoroCommand, PomodoroEvent, PomodoroState } from './pomodoro'
import type { PetSettings, SettingsChange } from './settings'
import type { Guest } from './visits'
import type { Outfit } from './weather'

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
  finishSetup: 'pet:finish-setup',
  showSection: 'pet:show-section',
  petMenu: 'pet:menu',
  openSettings: 'pet:open-settings',
  action: 'pet:action',
  appInfo: 'pet:app-info',
  pomodoro: 'pet:pomodoro',
  getPomodoro: 'pet:get-pomodoro',
  pomodoroCmd: 'pet:pomodoro-cmd',
  setDemo: 'pet:set-demo',
  petted: 'pet:petted',
  friends: 'pet:friends',
  getFriends: 'pet:get-friends',
  friendsCmd: 'pet:friends-cmd',
  daily: 'pet:daily',
  getDaily: 'pet:get-daily',
  drank: 'pet:drank',
  searchPlace: 'pet:search-place',
  shoo: 'pet:shoo',
  laser: 'pet:laser',
  notes: 'pet:notes',
  getNotes: 'pet:get-notes',
  addNote: 'pet:add-note',
  doneNote: 'pet:done-note',
  stretched: 'pet:stretched',
  visitFriend: 'pet:visit-friend',
  getGuest: 'pet:get-guest',
  guestBye: 'pet:guest-bye',
  guestInteractive: 'pet:guest-interactive'
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
  /** a Pomodoro focus round or break just ended */
  | { kind: 'pomodoro'; event: PomodoroEvent; fish: boolean }
  /** once, after the first-run setup */
  | { kind: 'settings_hint' }
  /** time for a glass of water */
  | { kind: 'water' }
  /** a prayer time just started */
  | { kind: 'prayer'; label: string }
  /** a distracting window during a focus round */
  | { kind: 'distraction'; site: string }
  /** he caught the laser dot */
  | { kind: 'caught' }
  /** time to stretch together */
  | { kind: 'stretch' }
  /** a focus streak milestone (days in a row with a Pomodoro) */
  | { kind: 'streak'; days: number }
  /** past bedtime: a yawn */
  | { kind: 'bedtime' }
  /** visits: off to a friend, a guest arrived, back home… */
  | { kind: 'visit'; text: string }
  /** first-run setup finished: say hi */
  | { kind: 'hello' }

/** The pet strolling along the bottom of the screen. */
export interface WalkState {
  walking: boolean
  facing: 'left' | 'right'
}

/** Daily-life things drawn on the pet (weather outfit, prayer mat, Ramadan lantern, water). */
export interface DailyState {
  outfit: Outfit | null
  /** the prayer mat is out (for a few minutes after a prayer time) */
  praying: boolean
  /** during Ramadan (if enabled): when iftar is today, else null */
  ramadan: { iftarAt: number | null } | null
  /** a glass of water waits for you */
  waterDue: boolean
  /** "stretch with me" is on */
  stretchDue: boolean
  /** past bedtime: yawning first, then lying across the screen */
  bedtime: 'sleepy' | 'lying' | null
  /** sitting on a distracting window */
  guarding: string | null
  /** chasing the laser dot */
  laser: boolean
}

export interface StickyNote {
  id: string
  text: string
  at: number
}

export interface PlaceResult {
  city: string
  country: string
  lat: number
  lon: number
}

export interface ProfileData {
  look: PetLook
  totals: { tasks: number; approvals: number; rainbows: number; pomodoros: number }
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
  /** Claude Code has been used on this computer (~/.claude exists) */
  claudeFound: boolean
  /** AgentPet's backups of the Claude Code settings file */
  backups: number
}

/** One-off things a Settings button does. */
export type SettingsAction =
  | 'disconnectClaude'
  | 'restoreClaudeBackup'
  | 'newPhoneTopic'
  | 'checkUpdates'
  | 'resetPosition'
  | 'replayOnboarding'
  | 'resetStats'
  | 'resetProgress'
  | 'resetSettings'
  | 'openDataFolder'

export const SETTINGS_ACTIONS: readonly SettingsAction[] = [
  'disconnectClaude',
  'restoreClaudeBackup',
  'newPhoneTopic',
  'checkUpdates',
  'resetPosition',
  'replayOnboarding',
  'resetStats',
  'resetProgress',
  'resetSettings',
  'openDataFolder'
]

export interface ActionResult {
  ok: boolean
  /** what to tell the user */
  message?: string
}

export interface AppInfo {
  version: string
  dataPath: string
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

export type { PetSettings, SettingsChange } from './settings'

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
  /** Settings window: another part of the app asked to show this section. */
  onShowSection(listener: (section: string) => void): () => void
  /** Right-click on the pet: the native pet menu. */
  petMenu(): void
  openSettings(section?: string): void
  action(action: SettingsAction): Promise<ActionResult>
  appInfo(): Promise<AppInfo>
  getPomodoro(): Promise<PomodoroState>
  onPomodoro(listener: (state: PomodoroState) => void): () => void
  pomodoro(command: PomodoroCommand): void
  /** Mood demo (not saved). */
  setDemo(on: boolean): void
  /** He was petted (click and hold): a little XP, counted for the recap. */
  petted(): void
  getFriends(): Promise<FriendsView>
  onFriends(listener: (view: FriendsView) => void): () => void
  friends(command: FriendsCommand): Promise<FriendsResult>
  getDaily(): Promise<DailyState>
  onDaily(listener: (state: DailyState) => void): () => void
  /** "I drank 💧" */
  drank(): void
  /** City search for weather / prayer times (sends the typed name to Open-Meteo). */
  searchPlace(query: string): Promise<PlaceResult[]>
  /** Shoo him off a distracting window (or off the screen at bedtime: snooze). */
  shoo(): void
  /** "Done ✓" after stretching together */
  stretched(): void
  getNotes(): Promise<StickyNote[]>
  onNotes(listener: (notes: StickyNote[]) => void): () => void
  addNote(text: string): void
  doneNote(id: string): void
  /** Sends your cat to visit an online friend; resolves with what to tell the user. */
  visitFriend(userId: string): Promise<string>
  /** The guest window: who is visiting. */
  getGuest(): Promise<Guest | null>
  /** The host taps "Bye": the guest goes home. */
  guestBye(): void
  guestInteractive(on: boolean): void
}
