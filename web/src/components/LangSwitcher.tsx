import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Globe } from 'lucide-react'
import { LANGS, useI18n, type Lang } from '@/i18n'
import { cx } from '@/lib/cx'
import { BX_EASE } from '@/components/motion/Reveal'

const SHORT: Record<Lang, string> = {
  zh: '中',
  en: 'EN',
  vi: 'VI',
}

export function LangSwitcher({
  align = 'right',
  variant = 'dropdown',
}: {
  align?: 'left' | 'right'
  variant?: 'dropdown' | 'segmented'
}) {
  const { lang, setLang, d } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (variant === 'segmented') {
    return (
      <div
        role="group"
        aria-label={d.nav.language}
        className="inline-flex items-center overflow-hidden rounded-[6px] border border-[var(--bx-border)]"
      >
        {LANGS.map((l, i) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            className={cx(
              'border-none px-2 py-1 font-mono text-[10.5px] font-semibold transition-colors',
              i > 0 && 'border-l border-[var(--bx-border)]',
              lang === l.code
                ? 'bg-[var(--bx-active)] font-semibold text-[var(--bx-brand-bright)]'
                : 'bg-transparent font-medium text-[var(--bx-text-dim)] hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]',
            )}
            aria-pressed={lang === l.code}
          >
            {SHORT[l.code]}
          </button>
        ))}
      </div>
    )
  }

  function pick(code: Lang) {
    setLang(code)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-[var(--bx-radius)] px-2.5 py-1.5 text-sm text-[var(--bx-text-muted)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe size={16} />
        <span className="hidden sm:inline">{LANGS.find((l) => l.code === lang)?.label}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: BX_EASE }}
            className={cx(
              'bx-card absolute z-50 mt-2 w-40 overflow-hidden bg-[var(--bx-bg-elevated)] p-1 shadow-[var(--bx-shadow-pop)]',
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            {LANGS.map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={l.code === lang}
                  onClick={() => pick(l.code)}
                  className={cx(
                    'flex w-full items-center justify-between rounded-[var(--bx-radius-sm)] px-3 py-2 text-sm transition-colors hover:bg-[var(--bx-hover)]',
                    l.code === lang ? 'text-[var(--bx-brand-bright)]' : 'text-[var(--bx-text-soft)]',
                  )}
                >
                  {l.label}
                  {l.code === lang ? <Check size={14} /> : null}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
