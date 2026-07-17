import { useEffect, useState } from 'react'
import { listChannelMonitors, type UserMonitorView } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

function statusTone(status: string | undefined): string {
  const s = (status || '').toLowerCase()
  if (s.includes('operat') || s === 'ok' || s === 'up' || s === 'healthy') {
    return 'bx-account-status bx-account-status--ok'
  }
  if (s.includes('degrad') || s.includes('slow') || s.includes('warn')) {
    return 'bx-account-status bx-account-status--warn'
  }
  if (s.includes('down') || s.includes('fail') || s.includes('error')) {
    return 'bx-account-status bx-account-status--danger'
  }
  return 'bx-account-status bx-account-status--muted'
}

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
      <h1 className="bx-account-page-title">{t.title}</h1>
      <p className="bx-account-page-sub">{t.subtitle}</p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

      {items.length === 0 ? (
        <div className="bx-account-panel mt-5">
          <p className="bx-account-empty">{t.empty}</p>
        </div>
      ) : (
        <div className="bx-account-table-wrap mt-5 overflow-x-auto">
          <table className="bx-account-table min-w-[560px]">
            <thead>
              <tr>
                <th>{t.colName}</th>
                <th>{t.colModel}</th>
                <th>{t.colStatus}</th>
                <th>{t.colLatency}</th>
                <th>{t.colAvail}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="font-bold text-[var(--bx-text)]">{m.name}</span>
                    {m.group_name ? (
                      <span className="ml-1 font-mono text-[10px] text-[var(--bx-text-dim)]">
                        ({m.group_name})
                      </span>
                    ) : null}
                  </td>
                  <td className="font-mono text-[11.5px]">{m.primary_model || '—'}</td>
                  <td>
                    <span className={statusTone(m.primary_status)}>
                      {m.primary_status || '—'}
                    </span>
                  </td>
                  <td className="num">
                    {m.primary_latency_ms != null ? `${m.primary_latency_ms}ms` : '—'}
                  </td>
                  <td className="num">
                    {m.availability_7d != null
                      ? `${Math.min(100, Math.max(0, m.availability_7d)).toFixed(1)}%`
                      : '—'}
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
