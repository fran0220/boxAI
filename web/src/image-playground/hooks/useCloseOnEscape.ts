import { useEffect, useRef } from 'react'

/**
 * Global ESC stack: modals push on register; only top handler runs.
 * So ESC closes only the topmost modal.
 */
const escStack: Array<{ id: number; handler: () => void }> = []
let nextId = 0

function globalKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (escStack.length === 0) return
  e.preventDefault()
  // Invoke top (last registered) handler
  escStack[escStack.length - 1].handler()
}

// Register global listeners once
let listenerAttached = false
function ensureListener() {
  if (listenerAttached) return
  listenerAttached = true
  window.addEventListener('keydown', globalKeyDown)
}

export function useCloseOnEscape(enabled: boolean, onClose: () => void) {
  const idRef = useRef<number | null>(null)
  const handlerRef = useRef(onClose)
  handlerRef.current = onClose

  useEffect(() => {
    if (!enabled) {
      // Cleanup
      if (idRef.current !== null) {
        const idx = escStack.findIndex((e) => e.id === idRef.current)
        if (idx !== -1) escStack.splice(idx, 1)
        idRef.current = null
      }
      return
    }

    ensureListener()
    const id = nextId++
    idRef.current = id
    escStack.push({ id, handler: () => handlerRef.current() })

    return () => {
      const idx = escStack.findIndex((e) => e.id === id)
      if (idx !== -1) escStack.splice(idx, 1)
      idRef.current = null
    }
  }, [enabled])
}
