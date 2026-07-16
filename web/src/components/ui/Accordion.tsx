import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown } from 'lucide-react'

export interface AccordionItem {
  q: string
  a: string
}

export function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const reduced = useReducedMotion()

  return (
    <div className="bx-card divide-y divide-[var(--bx-border)] overflow-hidden">
      {items.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={item.q}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium transition-colors hover:bg-[var(--bx-hover)] sm:px-6 sm:text-base"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span>{item.q}</span>
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: reduced ? 0 : 0.25 }}
                className="shrink-0 text-[var(--bx-text-dim)]"
              >
                <ChevronDown size={18} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduced ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-5 text-sm leading-relaxed text-[var(--bx-text-muted)] sm:px-6">
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
