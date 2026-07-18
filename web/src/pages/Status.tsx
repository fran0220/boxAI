import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { usePageMeta } from '@/lib/meta'
import { useI18n } from '@/i18n'
import {
  fetchPublicStatus,
  formatAvailability,
  formatLatency,
  type OverallStatus,
  type PublicStatusItem,
  type StatusPeriod,
} from '@/lib/public-status'
import {
  GroupPanel,
  MonitorStatusRow,
  OverallChip,
  PeriodPills,
  StatusEmpty,
  StatusError,
  StatusKpiStrip,
  StatusSkeleton,
} from '@/components/status/StatusParts'
import { cx } from '@/lib/cx'

export function Status() {
  const { d } = useI18n()
  const s = d.status
  usePageMeta(s.metaTitle, s.subtitle)

  const [period, setPeriod] = useState<StatusPeriod>('7d')
  const periodRef = useRef(period)
  periodRef.current = period

  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overall, setOverall] = useState<OverallStatus>('operational')
  const [items, setItems] = useState<PublicStatusItem[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const load = useCallback(
    async (silent = false, signal?: AbortSignal, forPeriod?: StatusPeriod) => {
      const requested = forPeriod ?? periodRef.current
      if (!silent) setLoading(true)
      if (!silent) setError(null)
      try {
        const data = await fetchPublicStatus(requested, signal)
        if (signal?.aborted) return
        if (requested !== periodRef.current) return
        setItems(data.items || [])
        setOverall(data.overall === 'degraded' ? 'degraded' : 'operational')
        setUpdatedAt(data.updated_at)
        setError(null)
        setReady(true)
      } catch (e) {
        if (signal?.aborted) return
        if (requested !== periodRef.current) return
        setError(e instanceof Error ? e.message : s.loadError)
        if (!silent) setReady(true)
      } finally {
        if (!silent && !signal?.aborted) setLoading(false)
      }
    },
    [s.loadError],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    setReady(false)
    setItems([])
    setUpdatedAt(null)
    setError(null)
    void load(false, ctrl.signal, period)
    return () => ctrl.abort()
  }, [period, load])

  useEffect(() => {
    const ctrl = new AbortController()
    const t = window.setInterval(() => {
      void load(true, ctrl.signal, periodRef.current)
    }, 45_000)
    return () => {
      ctrl.abort()
      window.clearInterval(t)
    }
  }, [period, load])

  const periodOptions = useMemo(
    () =>
      (['7d', '15d', '30d'] as StatusPeriod[]).map((value) => ({
        value,
        label: s.period[value],
      })),
    [s.period],
  )

  const statusLabel = useCallback(
    (st: string) => {
      const key = st as keyof typeof s.statusLabel
      return s.statusLabel[key] || s.statusLabel.unknown
    },
    [s.statusLabel],
  )

  const rowLabels = useMemo(
    () => ({
      latency: s.latency,
      ping: s.ping,
      availability: s.availability,
      past: s.past,
      now: s.now,
      status: statusLabel,
    }),
    [s, statusLabel],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, PublicStatusItem[]>()
    const ungrouped: PublicStatusItem[] = []
    for (const it of items) {
      const g = (it.group_name || '').trim()
      if (!g) {
        ungrouped.push(it)
        continue
      }
      const list = map.get(g) || []
      list.push(it)
      map.set(g, list)
    }
    return { map, ungrouped }
  }, [items])

  const kpis = useMemo(() => {
    const n = items.length
    let availSum = 0
    let availN = 0
    let latSum = 0
    let latN = 0
    // Prefer true last-24h counts when timeline timestamps exist; else
    // count monitors currently not operational (never invent "24h" events).
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    let last24hEvents = 0
    let hasUsableTimestamps = false
    let currentlyDegraded = 0
    for (const it of items) {
      if (it.availability != null && !Number.isNaN(it.availability)) {
        availSum += it.availability
        availN++
      }
      if (it.latency_ms != null && !Number.isNaN(it.latency_ms)) {
        latSum += it.latency_ms
        latN++
      }
      const st = it.status
      if (st === 'degraded' || st === 'failed' || st === 'error') {
        currentlyDegraded++
      }
      for (const p of it.timeline || []) {
        if (!p.checked_at) continue
        const t = Date.parse(p.checked_at)
        if (Number.isNaN(t)) continue
        hasUsableTimestamps = true
        if (now - t > dayMs || t > now + 60_000) continue
        if (p.status === 'degraded' || p.status === 'failed' || p.status === 'error') {
          last24hEvents++
        }
      }
    }
    const degradedCount = hasUsableTimestamps ? last24hEvents : currentlyDegraded
    const degradedLabel = hasUsableTimestamps
      ? s.kpi.degradedEvents24h
      : s.kpi.currentlyDegraded
    const avgAvail = availN ? availSum / availN : null
    const avgLat = latN ? latSum / latN : null
    return [
      {
        label: s.kpi.channels,
        value: String(n),
      },
      {
        label: s.kpi.avgAvailability.replace('{period}', s.period[period]),
        value: avgAvail != null ? formatAvailability(avgAvail) : '—',
        unit: avgAvail != null ? '%' : undefined,
        valueClass:
          avgAvail != null && avgAvail >= 99
            ? 'text-[var(--bx-success)]'
            : avgAvail != null && avgAvail >= 97
              ? 'text-[var(--bx-warning)]'
              : undefined,
      },
      {
        label: s.kpi.avgLatency,
        value: avgLat != null ? formatLatency(avgLat) : '—',
        unit: avgLat != null ? ' ms' : undefined,
      },
      {
        label: degradedLabel,
        value: String(degradedCount),
        valueClass:
          degradedCount > 0 ? 'text-[var(--bx-warning)]' : 'text-[var(--bx-text)]',
      },
    ]
  }, [items, period, s.kpi, s.period])

  const overallLabel = overall === 'operational' ? s.overall.operational : s.overall.degraded
  const showSkeleton = !ready || (loading && items.length === 0)
  const showError = ready && !loading && Boolean(error) && items.length === 0
  const showEmpty = ready && !loading && !error && items.length === 0
  const showData = ready && items.length > 0

  const updatedLine = updatedAt
    ? s.updatedInline
        .replace('{time}', new Date(updatedAt).toLocaleTimeString())
        .replace('{refresh}', s.autoRefresh)
    : s.autoRefresh

  return (
    <div>
      <div className="mx-auto max-w-[1200px] px-6 pb-24 pt-14 sm:pb-[96px] sm:pt-14">
        {/* Header — design: title left, period + overall + refresh right */}
        <header
          data-screen-label="状态头部"
          className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end"
        >
          <div>
            <p className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
              <span className="h-px w-5 bg-[var(--bx-brand)]" />
              {s.eyebrow}
            </p>
            <h1 className="mt-3.5 text-[32px] font-extrabold tracking-[-0.035em] sm:text-[38px]">
              {s.title}
            </h1>
            <p className="mt-2.5 text-sm text-[var(--bx-text-muted)]">
              {s.subtitle}{' '}
              <span className="font-mono text-xs text-[var(--bx-text-dim)]">{updatedLine}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <PeriodPills period={period} options={periodOptions} onChange={setPeriod} />
            {ready ? <OverallChip overall={overall} label={overallLabel} /> : null}
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--bx-border)] bg-transparent text-[var(--bx-text-dim)] transition hover:border-[var(--bx-border-strong)] hover:text-[var(--bx-brand-bright)] disabled:opacity-50"
              disabled={loading}
              title={s.refresh}
              onClick={() => void load(false, undefined, period)}
            >
              <RefreshCw size={14} className={cx(loading && 'animate-spin')} />
            </button>
          </div>
        </header>

        {showSkeleton ? <StatusSkeleton /> : null}
        {showError ? (
          <StatusError
            message={error || s.loadError}
            retryLabel={s.retry}
            onRetry={() => void load(false, undefined, period)}
          />
        ) : null}
        {showEmpty ? <StatusEmpty title={s.emptyTitle} description={s.emptyBody} /> : null}

        {showData ? (
          <>
            <StatusKpiStrip items={kpis} />

            {grouped.ungrouped.length > 0 ? (
              <GroupPanel
                name={s.ungrouped}
                count={s.monitorsCount.replace('{n}', String(grouped.ungrouped.length))}
              >
                {grouped.ungrouped.map((item) => (
                  <MonitorStatusRow key={item.id} item={item} labels={rowLabels} />
                ))}
              </GroupPanel>
            ) : null}

            {[...grouped.map.entries()].map(([name, list]) => (
              <GroupPanel
                key={name}
                name={name}
                count={s.monitorsCount.replace('{n}', String(list.length))}
              >
                {list.map((item) => (
                  <MonitorStatusRow key={item.id} item={item} labels={rowLabels} />
                ))}
              </GroupPanel>
            ))}

            <p className="mt-8 font-mono text-xs text-[var(--bx-text-dim)]">
              {s.legend.prefix}
              <span className="text-[var(--bx-success)]">{s.legend.ok}</span>
              {' · '}
              <span className="text-[var(--bx-warning)]">{s.legend.degraded}</span>
              {' · '}
              <span className="text-[var(--bx-danger)]">{s.legend.failed}</span>
              {s.legend.suffix.replace('{period}', s.period[period])}
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}
