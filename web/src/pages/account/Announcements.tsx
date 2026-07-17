import { useEffect, useState } from 'react'
import { listAnnouncements, markAnnouncementRead, type UserAnnouncement } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'
import { cx } from '@/lib/cx'

function tagFromTitle(title: string): { label: string; cls: string } {
  const t = title.toLowerCase()
  if (/维护|maintenance|downtime/.test(t)) {
    return { label: '维护', cls: 'bx-account-ann-tag--warn' }
  }
  if (/模型|model|gemini|claude|gpt|渠道/.test(t)) {
    return { label: '模型', cls: 'bx-account-ann-tag--info' }
  }
  if (/新|new|上线|launch|feature/.test(t)) {
    return { label: '新功能', cls: '' }
  }
  return { label: '公告', cls: 'bx-account-ann-tag--muted' }
}

export function AccountAnnouncements() {
  const { d, lang } = useI18n()
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
        // Mark all as "opened" for unread UX (always-open cards)
        if (!cancelled && list?.length) {
          const unread = list.filter((x) => !x.read_at)
          if (unread.length) {
            void Promise.all(unread.map((x) => markAnnouncementRead(x.id).catch(() => null)))
            setItems((prev) =>
              prev.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })),
            )
          }
        }
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

  function resolveTag(item: UserAnnouncement) {
    const raw = tagFromTitle(item.title)
    // Localized tag labels
    if (lang === 'en') {
      if (raw.cls.includes('warn')) return { ...raw, label: 'Maintenance' }
      if (raw.cls.includes('info')) return { ...raw, label: 'Model' }
      if (!raw.cls) return { ...raw, label: 'New' }
      return { ...raw, label: 'Notice' }
    }
    if (lang === 'vi') {
      if (raw.cls.includes('warn')) return { ...raw, label: 'Bảo trì' }
      if (raw.cls.includes('info')) return { ...raw, label: 'Model' }
      if (!raw.cls) return { ...raw, label: 'Mới' }
      return { ...raw, label: 'Thông báo' }
    }
    return raw
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
            return (
              <li
                key={item.id}
                className="bx-account-panel px-[22px] py-[18px]"
                style={{
                  borderColor: unread ? 'var(--bx-brand-ring)' : undefined,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className={cx('bx-account-ann-tag', tag.cls)}>{tag.label}</span>
                  {unread ? (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bx-brand)]" />
                  ) : null}
                  <span className="ml-auto font-mono text-[10.5px] text-[var(--bx-text-dim)]">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
                <p className="mt-3 mb-0 text-[15px] font-bold tracking-tight">{item.title}</p>
                <p className="mt-1.5 mb-0 text-[13px] leading-relaxed text-[var(--bx-text-muted)] text-pretty whitespace-pre-wrap">
                  {item.content}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
