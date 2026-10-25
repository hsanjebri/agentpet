import { useEffect, useState } from 'react'
import type { PetSettings } from '@shared/ipc'
import { DEFAULT_SKIN } from '@shared/skins'

const INITIAL: PetSettings = { skin: DEFAULT_SKIN, muted: false, focusMode: false, demo: false }

/** Current settings from the main process, updated live when they change in the tray. */
export function useSettings(): PetSettings {
  const [settings, setSettings] = useState(INITIAL)

  useEffect(() => {
    let active = true
    window.api.getSettings().then((s) => active && setSettings(s))
    const unsubscribe = window.api.onSettings(setSettings)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return settings
}
