import { useEffect, useState } from 'react'
import { listAnnouncements, markAnnouncementRead, type UserAnnouncement } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

export function AccountAnnouncements() {
  const { d } = useI18n()
  const t = d.accountAnnouncements
  usePageMeta(t.metaTitle)

  const [items, setItems] = useState<UserAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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

  async function onOpen(item: UserAnnouncement) {
    if (!item.read_at) {
      try {
        await markAnnouncementRead(item.id)
        setItems((prev) =>
          prev.map((x) => (x.id === item.id ? { ...x, read_at: new Date().toISOString() } : x)),
        )
      } catch {
        // ignore
      }
    }
  }

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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  const unreadCount = items.filter((x) => !x.read_at).length

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="bx-account-page-title">{t.title}</h1>
          <p className="bx-account-page-sub">{t.subtitle}</p>
        </div>
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
        <ul className="mt-5 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <details
                className="bx-account-panel group"
                onToggle={(e) => e.currentTarget.open && void onOpen(item)}
              >
                <summary className="flex cursor-pointer list-none items-center gap-2.5 px-5 py-3.5 font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                  <span
                    className={
                      item.read_at
                        ? 'h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bx-text-dim)]'
                        : 'h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bx-brand-bright)]'
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {item.created_at ? (
                    <span className="shrink-0 font-mono text-[10.5px] text-[var(--bx-text-dim)]">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  ) : null}
                </summary>
                <div className="border-t border-[var(--bx-line)] px-5 py-4 whitespace-pre-wrap text-sm text-[var(--bx-text-muted)]">
                  {item.content}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
