import { useCallback, useEffect, useMemo, useState } from 'react'
import { listChannelMonitors, type UserMonitorView } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'
import { cx } from '@/lib/cx'

const REFRESH_MS = 30_000
const SPARK_LEN = 30

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

function isOk(status: string | undefined): boolean {
  const s = (status || '').toLowerCase()
  return s.includes('operat') || s === 'ok' || s === 'up' || s === 'healthy'
}

function isBad(status: string | undefined): boolean {
  const s = (status || '').toLowerCase()
  return s.includes('down') || s.includes('fail') || s.includes('error')
}

function isWarn(status: string | undefined): boolean {
  const s = (status || '').toLowerCase()
  return s.includes('degrad') || s.includes('slow') || s.includes('warn')
}

function formatLatency(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms)}ms`
}

type SparkBar = { h: number; tone: 'ok' | 'bad' | 'warn' | 'empty'; title: string }

function buildSpark(item: UserMonitorView): SparkBar[] {
  const timeline = Array.isArray(item.timeline) ? item.timeline : []
  // API returns newest first typically; reverse for left=old, right=new
  const points = [...timeline].slice(0, SPARK_LEN).reverse()
  const bars: SparkBar[] = []
  const pad = Math.max(0, SPARK_LEN - points.length)
  for (let i = 0; i < pad; i += 1) {
    bars.push({ h: 15, tone: 'empty', title: '' })
  }
  for (const p of points) {
    let tone: SparkBar['tone'] = 'empty'
    let h = 15
    if (isOk(p.status)) {
      tone = 'ok'
      h = 70 + ((p.latency_ms ?? 0) % 30)
    } else if (isBad(p.status)) {
      tone = 'bad'
      h = 40
    } else if (isWarn(p.status)) {
      tone = 'warn'
      h = 55
    } else if (p.status) {
      tone = 'warn'
      h = 50
    }
    const lat = p.latency_ms != null ? `${Math.round(p.latency_ms)}ms` : '—'
    bars.push({
      h: Math.min(100, Math.max(12, h)),
      tone,
      title: `${p.checked_at || ''} · ${p.status || '—'} · ${lat}`,
    })
  }
  // If no timeline, show a single status-colored stub so chrome is visible
  if (points.length === 0) {
    const stubTone: SparkBar['tone'] = isOk(item.primary_status)
      ? 'ok'
      : isBad(item.primary_status)
        ? 'bad'
        : isWarn(item.primary_status)
          ? 'warn'
          : 'empty'
    return Array.from({ length: SPARK_LEN }, (_, i) => ({
      h: stubTone === 'empty' ? 15 : 45 + ((i * 17) % 40),
      tone: stubTone,
      title: item.primary_status || '',
    }))
  }
  return bars
}

export function AccountMonitor() {
  const { d } = useI18n()
  const t = d.accountMonitor
  usePageMeta(t.metaTitle)

  const [items, setItems] = useState<UserMonitorView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true)
    try {
      const res = await listChannelMonitors()
      setItems(res.items || [])
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [t.loadFailed])

  useEffect(() => {
    void load(false)
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => {
      void load(true)
      setTick((n) => n + 1)
    }, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [load])

  const stats = useMemo(() => {
    const total = items.length
    const up = items.filter((m) => isOk(m.primary_status)).length
    const latencies = items
      .map((m) => m.primary_latency_ms)
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
    const avgLat =
      latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : null
    const avails = items
      .map((m) => m.availability_7d)
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
    const avgAvail =
      avails.length > 0 ? avails.reduce((a, b) => a + b, 0) / avails.length : null
    const events = items.filter((m) => isBad(m.primary_status) || isWarn(m.primary_status)).length
    return { total, up, avgLat, avgAvail, events }
  }, [items])

  const allOk = stats.total > 0 && stats.up === stats.total && stats.events === 0

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="bx-account-page-title">{t.title}</h1>
        <span className={cx('bx-account-live', !allOk && stats.total > 0 && 'text-[var(--bx-warning)]')}>
          {stats.total === 0
            ? t.noLive
            : allOk
              ? t.liveAllOk
              : t.livePartial.replace('{up}', String(stats.up)).replace('{total}', String(stats.total))}
          {' · '}
          {t.autoRefresh}
        </span>
      </div>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="bx-account-panel bx-account-panel-pad">
          <p className="bx-account-mono-label">{t.statUptime}</p>
          <p
            className="bx-account-stat-value"
            style={{ color: stats.avgAvail != null ? 'var(--bx-success)' : undefined }}
          >
            {stats.avgAvail != null
              ? `${Math.min(100, Math.max(0, stats.avgAvail)).toFixed(2)}%`
              : '—'}
          </p>
        </div>
        <div className="bx-account-panel bx-account-panel-pad">
          <p className="bx-account-mono-label">{t.statLatency}</p>
          <p className="bx-account-stat-value">{formatLatency(stats.avgLat)}</p>
        </div>
        <div className="bx-account-panel bx-account-panel-pad">
          <p className="bx-account-mono-label">{t.statActive}</p>
          <p className="bx-account-stat-value">
            {stats.total > 0 ? `${stats.up}/${stats.total}` : '—'}
          </p>
        </div>
        <div className="bx-account-panel bx-account-panel-pad">
          <p className="bx-account-mono-label">{t.statEvents}</p>
          <p
            className="bx-account-stat-value"
            style={{ color: stats.events > 0 ? 'var(--bx-warning)' : undefined }}
          >
            {stats.total > 0 ? stats.events : '—'}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bx-account-panel mt-3">
          <p className="bx-account-empty">{t.empty}</p>
        </div>
      ) : (
        <div className="bx-account-table-wrap mt-3 overflow-x-auto">
          <table className="bx-account-table min-w-[720px]">
            <thead>
              <tr>
                <th>{t.colChannel}</th>
                <th>{t.colProbes}</th>
                <th className="text-right">{t.colLatency}</th>
                <th className="text-right">{t.colAvail}</th>
                <th>{t.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => {
                const bars = buildSpark(m)
                return (
                  <tr key={`${m.id}-${tick % 2}`}>
                    <td>
                      <span className="block font-bold text-[var(--bx-text)]">{m.name}</span>
                      <span className="mt-px block font-mono text-[10px] text-[var(--bx-text-dim)]">
                        {[m.provider, m.group_name, m.primary_model].filter(Boolean).join(' · ') ||
                          '—'}
                      </span>
                    </td>
                    <td>
                      <span className="bx-account-sparkline" aria-hidden>
                        {bars.map((b, i) => (
                          <i
                            key={i}
                            title={b.title}
                            className={cx(
                              b.tone === 'bad' && 'is-bad',
                              b.tone === 'warn' && 'is-warn',
                              b.tone === 'empty' && 'is-empty',
                            )}
                            style={{ height: `${b.h}%` }}
                          />
                        ))}
                      </span>
                    </td>
                    <td className="num text-right text-[var(--bx-text-soft)]">
                      {formatLatency(m.primary_latency_ms)}
                    </td>
                    <td className="num text-right text-[var(--bx-text-soft)]">
                      {m.availability_7d != null
                        ? `${Math.min(100, Math.max(0, m.availability_7d)).toFixed(1)}%`
                        : '—'}
                    </td>
                    <td>
                      <span className={statusTone(m.primary_status)}>
                        {m.primary_status || '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
