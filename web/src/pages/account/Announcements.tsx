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
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, read_at: new Date().toISOString() } : x)))
      } catch {
        // ignore
      }
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <h2 className="bx-display text-2xl font-bold tracking-tight">{t.title}</h2>
      <p className="mt-1 text-sm text-[var(--bx-text-muted)]">{t.subtitle}</p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[var(--bx-text-dim)]">{t.empty}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <details className="bx-card p-4" onToggle={(e) => e.currentTarget.open && void onOpen(item)}>
                <summary className="cursor-pointer font-medium">
                  {!item.read_at ? <span className="mr-2 text-[var(--bx-brand-bright)]">●</span> : null}
                  {item.title}
                </summary>
                <div className="mt-3 whitespace-pre-wrap text-sm text-[var(--bx-text-muted)]">{item.content}</div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
