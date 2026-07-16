import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, RefreshCw } from 'lucide-react'
import { useModels, type ModelKind } from '@/lib/models'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { BX_EASE } from '@/components/motion/Reveal'

export function ModelPicker({
  value,
  onChange,
  kind,
  className,
}: {
  value: string
  onChange: (v: string) => void
  kind: ModelKind
  className?: string
}) {
  const { d } = useI18n()
  const { byKind, models, loading, reload } = useModels()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const kindIds = useMemo(() => {
    const ids = byKind(kind)
    return ids.length > 0 ? ids : models.map((m) => m.id)
  }, [byKind, kind, models])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return kindIds
    return kindIds.filter((id) => id.toLowerCase().includes(q))
  }, [kindIds, query])

  useEffect(() => {
    if (!value && kindIds.length > 0) onChange(kindIds[0]!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindIds.length])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function pick(id: string) {
    onChange(id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={ref} className={cx('relative', className)}>
      <div className="relative">
        <input
          className="bx-input pr-16 text-sm"
          placeholder={d.create.model.placeholder}
          value={open ? query : value}
          onFocus={() => {
            setQuery('')
            setOpen(true)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered.length > 0) pick(filtered[0]!)
              else if (query.trim()) pick(query.trim())
            }
            if (e.key === 'Escape') setOpen(false)
          }}
          aria-label={d.create.model.label}
          aria-expanded={open}
          aria-haspopup="listbox"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          <button
            type="button"
            className="rounded-[var(--bx-radius-sm)] p-1.5 text-[var(--bx-text-dim)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-teal-bright)]"
            onClick={reload}
            aria-label={d.create.model.reload}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : undefined} />
          </button>
          <button
            type="button"
            className="rounded-[var(--bx-radius-sm)] p-1.5 text-[var(--bx-text-dim)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
            onClick={() => setOpen((v) => !v)}
            aria-label={d.create.model.toggleList}
          >
            <ChevronDown
              size={14}
              className={cx('transition-transform duration-bx ease-expo', open && 'rotate-180')}
            />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: BX_EASE }}
            className="bx-card absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto bg-[var(--bx-bg-elevated)] p-1 shadow-[var(--bx-shadow-pop)]"
            role="listbox"
          >
            {loading && filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-xs text-[var(--bx-text-dim)]">{d.create.model.loading}</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-xs text-[var(--bx-text-dim)]">{d.create.model.empty}</li>
            ) : (
              filtered.map((id) => {
                const selected = id === value
                return (
                  <li key={id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => pick(id)}
                      className={cx(
                        'flex w-full items-center justify-between gap-2 truncate rounded-[var(--bx-radius-sm)] px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bx-hover)]',
                        selected
                          ? 'bg-[var(--bx-active)] text-[var(--bx-teal-bright)]'
                          : 'text-[var(--bx-text-soft)]',
                      )}
                    >
                      <span className="truncate font-mono text-[13px]">{id}</span>
                      {selected ? <Check size={14} className="shrink-0" /> : null}
                    </button>
                  </li>
                )
              })
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
