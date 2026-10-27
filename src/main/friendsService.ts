// Friends over Supabase: anonymous sign-in, your pet's public card (name, skin, level), friend
// requests by code, and online dots (Realtime presence on private per-user channels).
//
// Nothing here runs, loads or connects until enable() is called (Friends switched on). The
// Supabase client is created through `deps.createClient`, which the app loads lazily, so with
// Friends off the library isn't even imported. Errors never escape: the view just says offline.
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import {
  FRIENDS_OFF,
  type FriendsCommand,
  type FriendsResult,
  type FriendsView,
  RESPOND_ACTIONS,
  addResultMessage,
  normalizeCode,
  viewFromRows
} from '../shared/friends'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

/** Where the anonymous session is kept between starts (encrypted by the app). */
export interface SessionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface PetCard {
  name: string
  skin: string
  level: number
}

export interface FriendsDeps {
  config: SupabaseConfig
  createClient: (
    url: string,
    key: string,
    options: Record<string, unknown>
  ) => Promise<SupabaseClient>
  storage: SessionStorage
  pet(): PetCard
  onView(view: FriendsView): void
  /** a broadcast from a friend arrived on our channel (visits) */
  onMessage?(event: string, payload: unknown): void
  /** how often to refresh the lists while online */
  pollMs?: number
  retryMs?: number
}

export function isConfigured(config: SupabaseConfig): boolean {
  return /^https:\/\//.test(config.url) && config.anonKey.length > 20
}

export class FriendsService {
  private client: SupabaseClient | null = null
  private me: string | null = null
  private view: FriendsView = FRIENDS_OFF
  private own: RealtimeChannel | null = null
  private watching = new Map<string, RealtimeChannel>()
  private online = new Set<string>()
  private rows: Array<Record<string, unknown>> = []
  private timer: ReturnType<typeof setTimeout> | undefined
  private enabled = false
  private lastCard = ''

  constructor(private deps: FriendsDeps) {}

  current(): FriendsView {
    return this.view
  }

  private set(change: Partial<FriendsView>): void {
    this.view = { ...this.view, ...change }
    this.deps.onView(this.view)
  }

  private publish(): void {
    this.set({ ...viewFromRows(this.rows, this.online) })
  }

  async enable(): Promise<void> {
    if (this.enabled) return
    this.enabled = true
    if (!isConfigured(this.deps.config)) return this.set({ ...FRIENDS_OFF, status: 'unconfigured' })
    this.set({ ...FRIENDS_OFF, status: 'connecting' })
    await this.connect()
  }

  disable(): void {
    this.enabled = false
    clearTimeout(this.timer)
    this.closeChannels()
    const client = this.client
    this.client = null
    this.me = null
    this.rows = []
    void client?.removeAllChannels().catch(() => {})
    this.set(FRIENDS_OFF)
  }

  private async connect(): Promise<void> {
    clearTimeout(this.timer)
    if (!this.enabled) return
    try {
      const { url, anonKey } = this.deps.config
      this.client ??= await this.deps.createClient(url, anonKey, {
        auth: {
          storage: this.deps.storage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      })
      const client = this.client
      const { data } = await client.auth.getSession()
      let user = data.session?.user ?? null
      if (!user) {
        const signed = await client.auth.signInAnonymously()
        if (signed.error) throw signed.error
        user = signed.data.user
      }
      if (!user || !this.enabled) return
      this.me = user.id
      await this.syncPet(true)
      await client.realtime.setAuth()
      this.openOwnChannel()
      await this.refresh()
      this.set({ status: 'online' })
      this.schedule(this.deps.pollMs ?? 30_000)
    } catch {
      this.goOffline()
    }
  }

  private goOffline(): void {
    if (!this.enabled) return
    this.closeChannels()
    this.set({ status: 'offline' })
    this.schedule(this.deps.retryMs ?? 60_000, true)
  }

  private schedule(ms: number, reconnect = false): void {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      if (reconnect) void this.connect()
      else
        void this.syncPet()
          .then(() => this.refresh())
          .then(() => this.schedule(ms))
          .catch(() => this.goOffline())
    }, ms)
  }

  /** Your pet's card on the server (and your friend code). Only sends when it changed. */
  async syncPet(force = false): Promise<void> {
    if (!this.client || !this.me) return
    const pet = this.deps.pet()
    const card = JSON.stringify(pet)
    if (!force && card === this.lastCard) return
    const { data, error } = await this.client.rpc('upsert_my_pet', {
      p_name: pet.name,
      p_skin: pet.skin,
      p_level: pet.level
    })
    if (error) throw error
    this.lastCard = card
    if (typeof data === 'string') this.set({ myCode: data })
  }

  private async refresh(): Promise<void> {
    if (!this.client) return
    const { data, error } = await this.client.rpc('friends_overview')
    if (error) throw error
    this.rows = (data ?? []) as Array<Record<string, unknown>>
    this.watchFriends()
    this.publish()
  }

  /** You on your own channel: friends see your online dot. */
  private openOwnChannel(): void {
    if (!this.client || !this.me || this.own) return
    const me = this.me
    this.own = this.client
      .channel(`pet:${me}`, { config: { private: true, presence: { key: me } } })
      .on('broadcast', { event: '*' }, (msg) => this.deps.onMessage?.(msg.event, msg.payload))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void this.own?.track({ at: Date.now() })
      })
  }

  /** Each accepted friend's channel, to see whether they're online. */
  private watchFriends(): void {
    if (!this.client) return
    const ids = new Set(this.rows.filter((r) => r.kind === 'friend').map((r) => String(r.user_id)))
    for (const [id, channel] of this.watching) {
      if (ids.has(id)) continue
      void this.client.removeChannel(channel)
      this.watching.delete(id)
      this.online.delete(id)
    }
    for (const id of ids) {
      if (this.watching.has(id)) continue
      const channel = this.client.channel(`pet:${id}`, {
        config: { private: true, presence: { key: this.me ?? undefined } }
      })
      channel
        .on('presence', { event: 'sync' }, () => {
          const here = Object.keys(channel.presenceState()).includes(id)
          if (here) this.online.add(id)
          else this.online.delete(id)
          this.publish()
        })
        .subscribe()
      this.watching.set(id, channel)
    }
  }

  /** Who handles broadcasts from friends (visits). */
  setMessageHandler(handler: (event: string, payload: unknown) => void): void {
    this.deps.onMessage = handler
  }

  /** Our user id once signed in (for visits). */
  myId(): string | null {
    return this.me
  }

  isFriend(userId: string): boolean {
    return this.view.friends.some((f) => f.userId === userId)
  }

  /** A broadcast to a friend's channel (only friends may send there). False if it didn't go. */
  async sendTo(userId: string, event: string, payload: Record<string, unknown>): Promise<boolean> {
    const channel = this.watching.get(userId)
    if (!channel || this.view.status !== 'online') return false
    try {
      return (await channel.send({ type: 'broadcast', event, payload })) === 'ok'
    } catch {
      return false
    }
  }

  private closeChannels(): void {
    const client = this.client
    for (const channel of [...this.watching.values(), ...(this.own ? [this.own] : [])])
      void client?.removeChannel(channel)
    this.watching.clear()
    this.online.clear()
    this.own = null
  }

  async command(cmd: FriendsCommand): Promise<FriendsResult> {
    if (cmd.type === 'retry') {
      if (!this.enabled) return { ok: false, message: 'Friends is off.' }
      this.set({ status: 'connecting' })
      await this.connect()
      return { ok: this.view.status === 'online' }
    }
    if (!this.client || this.view.status !== 'online')
      return { ok: false, message: 'Friends is offline right now.' }
    try {
      if (cmd.type === 'add') {
        const code = normalizeCode(cmd.code)
        if (!code) return { ok: false, message: 'Codes look like NOODLE-48K2.' }
        const { data, error } = await this.client.rpc('send_friend_request', { p_code: code })
        if (error) throw error
        await this.refresh()
        return addResultMessage(String(data))
      }
      if (!RESPOND_ACTIONS.includes(cmd.action) || !Number.isInteger(cmd.id)) return { ok: false }
      const { error } = await this.client.rpc('respond_friend', {
        p_id: cmd.id,
        p_action: cmd.action
      })
      if (error) throw error
      await this.refresh()
      return { ok: true }
    } catch {
      return { ok: false, message: 'That didn’t work: Friends may be offline.' }
    }
  }
}
