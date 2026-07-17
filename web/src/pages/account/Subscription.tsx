import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getActiveSubscriptions, getMySubscriptions, type UserSubscription } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

export function AccountSubscription() {
  const { d } = useI18n()
  const t = d.accountSubscription
  usePageMeta(t.metaTitle)

  const [items, setItems] = useState<UserSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        let list = await getActiveSubscriptions().catch(() => null)
        if (!list) list = await getMySubscriptions()
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="bx-display text-2xl font-bold tracking-tight">{t.title}</h2>
          <p className="mt-1 text-sm text-[var(--bx-text-muted)]">{t.subtitle}</p>
        </div>
        <Link to="/checkout?type=subscription" className="bx-btn bx-btn-primary bx-btn-sm">
          {t.buy}
        </Link>
      </div>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[var(--bx-text-dim)]">{t.empty}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((sub) => (
            <li key={sub.id} className="bx-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{sub.group?.name || `Group #${sub.group_id}`}</p>
                  <p className="mt-0.5 text-xs text-[var(--bx-text-dim)]">
                    {t.status}: {sub.status}
                    {sub.expires_at ? ` · ${t.expires}: ${new Date(sub.expires_at).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="text-right text-xs text-[var(--bx-text-muted)]">
                  <p>
                    {t.daily}: ${sub.daily_usage_usd.toFixed(2)}
                  </p>
                  <p>
                    {t.weekly}: ${sub.weekly_usage_usd.toFixed(2)}
                  </p>
                  <p>
                    {t.monthly}: ${sub.monthly_usage_usd.toFixed(2)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
