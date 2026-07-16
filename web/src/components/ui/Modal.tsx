import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { cx } from '@/lib/cx'

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  wide?: boolean
}) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cx(
              'bx-card relative max-h-[86vh] w-full overflow-hidden bg-[var(--bx-bg-elevated)] shadow-[var(--bx-shadow-pop)]',
              wide ? 'max-w-3xl' : 'max-w-lg',
            )}
            initial={reduced ? false : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-[var(--bx-border)] px-5 py-3">
              <h3 className="text-sm font-semibold">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-[var(--bx-text-dim)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[calc(86vh-52px)] overflow-y-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
