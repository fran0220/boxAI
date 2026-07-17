import { useEffect, useState } from 'react'
import { listChannelMonitors, type UserMonitorView } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

export function AccountMonitor() {
  const { d } = useI18n()
  const t = d.accountMonitor
  usePageMeta(t.metaTitle)

  const [items, setItems] = useState<UserMonitorView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await listChannelMonitors()
        if (!cancelled) setItems(res.items || [])
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

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[var(--bx-text-dim)]">{t.empty}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-[var(--bx-border)] text-xs text-[var(--bx-text-dim)]">
              <tr>
                <th className="pb-2 pr-3 font-medium">{t.colName}</th>
                <th className="pb-2 pr-3 font-medium">{t.colModel}</th>
                <th className="pb-2 pr-3 font-medium">{t.colStatus}</th>
                <th className="pb-2 pr-3 font-medium">{t.colLatency}</th>
                <th className="pb-2 font-medium">{t.colAvail}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-b border-[var(--bx-border)]/60">
                  <td className="py-2.5 pr-3 font-medium">
                    {m.name}
                    {m.group_name ? (
                      <span className="ml-1 text-xs text-[var(--bx-text-dim)]">({m.group_name})</span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{m.primary_model || '—'}</td>
                  <td className="py-2.5 pr-3">{m.primary_status || '—'}</td>
                  <td className="py-2.5 pr-3 tabular-nums">
                    {m.primary_latency_ms != null ? `${m.primary_latency_ms}ms` : '—'}
                  </td>
                  <td className="py-2.5 tabular-nums">
                    {m.availability_7d != null ? `${(m.availability_7d * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
