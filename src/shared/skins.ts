export type SkinId = 'noodle' | 'mochi' | 'zitouna' | 'byte' | 'ribbit' | 'bolt'

export interface SkinInfo {
  id: SkinId
  name: string
  ready: boolean // the other vector skins arrive in Phase 4
}

export const SKINS: readonly SkinInfo[] = [
  { id: 'noodle', name: 'Noodle', ready: true },
  { id: 'mochi', name: 'Mochi', ready: false },
  { id: 'zitouna', name: 'Zitouna', ready: false },
  { id: 'byte', name: 'Byte', ready: false },
  { id: 'ribbit', name: 'Ribbit', ready: false },
  { id: 'bolt', name: 'Bolt', ready: false }
]

export const DEFAULT_SKIN: SkinId = 'noodle'

/** Falls back to the default for unknown or not-yet-available skins (e.g. an old settings file). */
export function usableSkin(id: unknown): SkinId {
  const skin = SKINS.find((s) => s.id === id)
  return skin?.ready ? skin.id : DEFAULT_SKIN
}
