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

/**
 * Click-through everywhere except the pet, plus custom dragging (the window is frameless).
 * The main process forwards mouse moves even while the window ignores the mouse, so we can
 * turn interactivity on as soon as the pointer is over the pet.
 */
interface Handlers {
  onClick?(): void
  /** the pointer moved onto / off the pet itself (not its controls) */
  onHover?(hovering: boolean): void
}

export function usePetPointer(handlers: Handlers = {}): void {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    let interactive = false
    let dragging = false
    let hovering = false

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
      if (dragging) return
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
    }
    const onUp = async (e: MouseEvent): Promise<void> => {
      if (!dragging) return
      dragging = false
      const { moved } = await window.api.dragEnd()
      if (!moved) handlersRef.current.onClick?.()
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
