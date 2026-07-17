import { useEffect, useState } from 'react'
import { getUsageDashboardStats, listUsage, type UsageLog, type UserDashboardStats } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

export function AccountUsage() {
  const { d } = useI18n()
  const t = d.accountUsage
  usePageMeta(t.metaTitle)

  const [stats, setStats] = useState<UserDashboardStats | null>(null)
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [s, list] = await Promise.all([getUsageDashboardStats(), listUsage(1, 30)])
        if (cancelled) return
        setStats(s)
        setLogs(list.items || [])
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
      <h2 className="bx-display text-2xl font-bold tracking-tight">{t.title}</h2>
      <p className="mt-1 text-sm text-[var(--bx-text-muted)]">{t.subtitle}</p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

      {stats ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card label={t.todayRequests} value={String(stats.today_requests)} />
          <Card label={t.todayTokens} value={formatNum(stats.today_tokens)} />
          <Card label={t.todayCost} value={`$${(stats.today_actual_cost ?? stats.today_cost).toFixed(4)}`} />
          <Card label={t.totalCost} value={`$${(stats.total_actual_cost ?? stats.total_cost).toFixed(2)}`} />
        </div>
      ) : null}

      <h3 className="mt-8 text-sm font-semibold text-[var(--bx-text-soft)]">{t.recent}</h3>
      <div className="mt-3 overflow-x-auto">
        {logs.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--bx-text-dim)]">{t.empty}</p>
        ) : (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-[var(--bx-border)] text-xs text-[var(--bx-text-dim)]">
              <tr>
                <th className="pb-2 pr-3 font-medium">{t.colTime}</th>
                <th className="pb-2 pr-3 font-medium">{t.colModel}</th>
                <th className="pb-2 pr-3 font-medium">{t.colTokens}</th>
                <th className="pb-2 font-medium">{t.colCost}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr key={row.id} className="border-b border-[var(--bx-border)]/60">
                  <td className="py-2.5 pr-3 text-[var(--bx-text-muted)]">
                    {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{row.model || '—'}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{row.total_tokens ?? '—'}</td>
                  <td className="py-2.5 tabular-nums">
                    ${((row.actual_cost ?? row.total_cost) ?? 0).toFixed(6)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bx-card p-4">
      <p className="text-xs text-[var(--bx-text-dim)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
