import type { StickyNote } from '@shared/ipc'
import { useEffect, useState } from 'react'

/** Sticky notes, live from the main process (oldest first). */
export function useNotes(): StickyNote[] {
  const [notes, setNotes] = useState<StickyNote[]>([])
  useEffect(() => {
    window.api.getNotes().then(setNotes)
    return window.api.onNotes(setNotes)
  }, [])
  return notes
}
