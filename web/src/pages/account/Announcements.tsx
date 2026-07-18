import { useCallback, useEffect, useState } from 'react'
import { listAnnouncements, markAnnouncementRead, type UserAnnouncement } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'
import { cx } from '@/lib/cx'

/**
 * Prefer API type/category/tag when present. Otherwise only apply a conservative
 * maintenance keyword match — never invent "model/new feature" labels from titles.
 */
function resolveAnnouncementTag(
  item: UserAnnouncement,
  labels: { notice: string; maintenance: string },
): { label: string; cls: string } {
  const apiRaw = (item.tag || item.type || item.category || '').trim()
  if (apiRaw) {
    const lower = apiRaw.toLowerCase()
    if (/维护|maintenance|downtime|outage|warn/.test(lower)) {
      return { label: apiRaw, cls: 'bx-account-ann-tag--warn' }
    }
    if (/模型|model|update|info/.test(lower)) {
      return { label: apiRaw, cls: 'bx-account-ann-tag--info' }
    }
    if (/新|new|feature|launch/.test(lower)) {
      return { label: apiRaw, cls: '' }
    }
    return { label: apiRaw, cls: 'bx-account-ann-tag--muted' }
  }

  if (/维护|maintenance|downtime|planned\s*outage/i.test(item.title || '')) {
    return { label: labels.maintenance, cls: 'bx-account-ann-tag--warn' }
  }
  return { label: labels.notice, cls: 'bx-account-ann-tag--muted' }
}

export function AccountAnnouncements() {
  const { d } = useI18n()
  const t = d.accountAnnouncements
  usePageMeta(t.metaTitle)

  const [items, setItems] = useState<UserAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  /** Expanded item ids — open marks as read (no auto mark-all on mount). */
  const [openIds, setOpenIds] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listAnnouncements(false)
        if (!cancelled) setItems(list || [])
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t.loadFailed)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t.loadFailed])

  const markOneRead = useCallback(async (id: number) => {
    setItems((prev) => {
      const target = prev.find((x) => x.id === id)
      if (!target || target.read_at) return prev
      return prev.map((x) =>
        x.id === id ? { ...x, read_at: new Date().toISOString() } : x,
      )
    })
    try {
      await markAnnouncementRead(id)
    } catch {
      /* best-effort; local state already updated for UX */
    }
  }, [])

  async function markAllRead() {
    setBusy(true)
    try {
      const unread = items.filter((x) => !x.read_at)
      await Promise.all(unread.map((x) => markAnnouncementRead(x.id).catch(() => null)))
      setItems((prev) =>
        prev.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })),
      )
    } finally {
      setBusy(false)
    }
  }

  function toggleOpen(item: UserAnnouncement) {
    const id = item.id
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    if (!item.read_at) void markOneRead(id)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  const unreadCount = items.filter((x) => !x.read_at).length

  function resolveTag(item: UserAnnouncement) {
    return resolveAnnouncementTag(item, {
      notice: t.tagNotice,
      maintenance: t.tagMaintenance,
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="bx-account-page-title">{t.title}</h1>
        {unreadCount > 0 ? (
          <button
            type="button"
            className="bx-btn bx-btn-ghost bx-btn-sm"
            disabled={busy}
            onClick={() => void markAllRead()}
          >
            {t.markAllRead}
          </button>
        ) : null}
      </div>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

      {items.length === 0 ? (
        <div className="bx-account-panel mt-5">
          <p className="bx-account-empty">{t.empty}</p>
        </div>
      ) : (
        <ul className="mt-5 m-0 flex list-none flex-col gap-3 p-0">
          {items.map((item) => {
            const tag = resolveTag(item)
            const unread = !item.read_at
            const open = openIds.has(item.id)
            return (
              <li
                key={item.id}
                className="bx-account-panel overflow-hidden"
                style={{
                  borderColor: unread ? 'var(--bx-brand-ring)' : undefined,
                }}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-2.5 border-none bg-transparent px-[22px] py-[18px] text-left"
                  aria-expanded={open}
                  onClick={() => toggleOpen(item)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className={cx('bx-account-ann-tag', tag.cls)}>{tag.label}</span>
                      {unread ? (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bx-brand)]" />
                      ) : null}
                      <span className="ml-auto font-mono text-[10.5px] text-[var(--bx-text-dim)]">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <p className="mt-3 mb-0 text-[15px] font-bold tracking-tight text-[var(--bx-text)]">
                      {item.title}
                    </p>
                  </div>
                  <span
                    className="mt-1 shrink-0 font-mono text-[11px] text-[var(--bx-text-dim)]"
                    aria-hidden
                  >
                    {open ? '▴' : '▾'}
                  </span>
                </button>
                {open ? (
                  <div className="border-t border-[var(--bx-line)] px-[22px] pb-[18px] pt-3">
                    <p className="m-0 text-[13px] leading-relaxed text-[var(--bx-text-muted)] text-pretty whitespace-pre-wrap">
                      {item.content}
                    </p>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
