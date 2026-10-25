import { useEffect, useRef } from 'react'

/** True over the pet's painted pixels or a control (bubble buttons), not the transparent area. */
function isOverPet(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-pet-hit], [data-ui]') !== null
}

/** Only the pet itself can be dragged; controls just get clicked. */
function isDraggable(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('[data-pet-hit]') !== null &&
    target.closest('[data-ui]') === null
  )
}

interface Handlers {
  onClick?(): void
  /** the pointer moved onto / off the pet itself (not its controls) */
  onHover?(hovering: boolean): void
  /** click and hold without moving = petting him; called with true, then false on release */
  onPet?(petting: boolean): void
}

const HOLD_MS = 450
const STILL_PX = 4

/**
 * Click-through everywhere except the pet, plus custom dragging (the window is frameless).
 * The main process forwards mouse moves even while the window ignores the mouse, so we can
 * turn interactivity on as soon as the pointer is over the pet.
 */
export function usePetPointer(handlers: Handlers = {}): void {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    let interactive = false
    let dragging = false
    let hovering = false
    let petting = false
    let holdTimer: ReturnType<typeof setTimeout> | undefined
    let downAt = { x: 0, y: 0 }

    const setHovering = (value: boolean): void => {
      if (value === hovering) return
      hovering = value
      handlersRef.current.onHover?.(value)
    }

    const setInteractive = (value: boolean): void => {
      if (value === interactive) return
      interactive = value
      window.api.setInteractive(value)
    }

    const onMove = (e: MouseEvent): void => {
      if (dragging) {
        if (Math.hypot(e.screenX - downAt.x, e.screenY - downAt.y) > STILL_PX)
          clearTimeout(holdTimer)
        return
      }
      setInteractive(isOverPet(e.target))
      setHovering(isDraggable(e.target))
    }
    const onLeave = (): void => {
      if (dragging) return
      setInteractive(false)
      setHovering(false)
    }
    const onDown = (e: MouseEvent): void => {
      if (e.button !== 0 || !isDraggable(e.target)) return
      e.preventDefault()
      dragging = true
      window.api.dragStart()
      downAt = { x: e.screenX, y: e.screenY }
      // held still for a moment: that's a stroke, not a drag or a click
      holdTimer = setTimeout(() => {
        petting = true
        handlersRef.current.onPet?.(true)
      }, HOLD_MS)
    }
    const onUp = async (e: MouseEvent): Promise<void> => {
      if (!dragging) return
      dragging = false
      clearTimeout(holdTimer)
      const wasPetting = petting
      if (petting) {
        petting = false
        handlersRef.current.onPet?.(false)
      }
      const { moved } = await window.api.dragEnd()
      if (!moved && !wasPetting) handlersRef.current.onClick?.()
      setInteractive(isOverPet(e.target))
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    document.documentElement.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      document.documentElement.removeEventListener('mouseleave', onLeave)
    }
  }, [])
}
