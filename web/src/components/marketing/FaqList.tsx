import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Plus } from 'lucide-react'
import { BX_EASE } from '@/components/motion/Reveal'

export type FaqItem = { q: string; a: string }

/** Numbered border-row FAQ (Home design language): 01/02…, plus→×, first open. */
export function FaqList({
  items,
  defaultOpen = 0,
  idPrefix = 'faq',
}: {
  items: FaqItem[]
  /** Index initially open; `null` keeps all closed. */
  defaultOpen?: number | null
  /** Stable id prefix when multiple FaqLists share a page. */
  idPrefix?: string
}) {
  const [open, setOpen] = useState<number | null>(defaultOpen)
  const reduced = useReducedMotion()

  return (
    <div className="border-t border-[var(--bx-border)]">
      {items.map((item, i) => {
        const isOpen = open === i
        const num = String(i + 1).padStart(2, '0')
        const buttonId = `${idPrefix}-btn-${i}`
        const panelId = `${idPrefix}-panel-${i}`
        return (
          <div key={item.q} className="border-b border-[var(--bx-border)]">
            <button
              type="button"
              id={buttonId}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-1 py-[18px] text-left text-[15px] font-bold tracking-tight text-[var(--bx-text)] transition-colors hover:text-[var(--bx-brand-bright)]"
            >
              <span className="flex items-baseline gap-3.5">
                <span className="font-mono text-[11px] font-normal text-[var(--bx-text-dim)]">
                  {num}
                </span>
                {item.q}
              </span>
              <motion.span
                aria-hidden
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: reduced ? 0 : 0.28, ease: BX_EASE }}
                className="inline-flex shrink-0 text-[var(--bx-text-dim)]"
              >
                <Plus size={16} strokeWidth={2} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduced ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: BX_EASE }}
                  className="overflow-hidden"
                >
                  <p className="m-0 max-w-[640px] pr-8 pb-5 pl-[33px] text-[13.5px] leading-[1.75] text-[var(--bx-text-muted)]">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
