import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getActiveSubscriptions, getMySubscriptions, type UserSubscription } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

function statusTone(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('active') || s === 'ok') return 'bx-account-status bx-account-status--ok'
  if (s.includes('expir') || s.includes('cancel')) return 'bx-account-status bx-account-status--warn'
  return 'bx-account-status bx-account-status--muted'
}

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
          <h1 className="bx-account-page-title">{t.title}</h1>
          <p className="bx-account-page-sub">{t.subtitle}</p>
        </div>
        <Link to="/checkout?type=subscription" className="bx-btn bx-btn-primary bx-btn-sm">
          {t.buy}
        </Link>
      </div>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

      {items.length === 0 ? (
        <div className="bx-account-panel mt-5">
          <p className="bx-account-empty">{t.empty}</p>
          <div className="flex justify-center pb-6">
            <Link to="/pricing" className="bx-btn bx-btn-ghost bx-btn-sm">
              {t.viewPlans}
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {items.map((sub) => (
            <li key={sub.id} className="bx-account-panel bx-account-panel-pad">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="m-0 text-[15px] font-bold">
                    {sub.group?.name || `Group #${sub.group_id}`}
                  </p>
                  <p className="mt-1.5">
                    <span className={statusTone(sub.status)}>{sub.status}</span>
                  </p>
                </div>
                {sub.expires_at ? (
                  <p className="m-0 font-mono text-[11px] text-[var(--bx-text-dim)]">
                    {t.expires}: {new Date(sub.expires_at).toLocaleDateString()}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--bx-line)] pt-3">
                <div>
                  <p className="bx-account-mono-label">{t.daily}</p>
                  <p className="mt-1 font-mono text-sm tabular-nums">${sub.daily_usage_usd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="bx-account-mono-label">{t.weekly}</p>
                  <p className="mt-1 font-mono text-sm tabular-nums">${sub.weekly_usage_usd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="bx-account-mono-label">{t.monthly}</p>
                  <p className="mt-1 font-mono text-sm tabular-nums">${sub.monthly_usage_usd.toFixed(2)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
