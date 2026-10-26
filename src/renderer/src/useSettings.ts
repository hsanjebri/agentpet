import { useEffect, useState } from 'react'
import type { PetSettings } from '@shared/ipc'
import { defaultSettings } from '@shared/settings'

// until the main process answers: defaults, with the OS-dependent features off
const INITIAL: PetSettings = {
  ...defaultSettings(),
  music: false,
  musicSupported: false,
  autoHideSupported: false,
  demo: false,
  startOnLogin: false,
  startOnLoginSupported: false
}

/** Current settings from the main process, updated live when they change anywhere. */
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
