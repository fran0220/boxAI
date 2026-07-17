import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { usePageMeta } from '@/lib/meta'
import { useI18n } from '@/i18n'
import {
  fetchPublicStatus,
  type OverallStatus,
  type PublicStatusItem,
  type StatusPeriod,
} from '@/lib/public-status'
import {
  GroupPanel,
  MonitorStatusCard,
  OverallChip,
  PeriodPills,
  StatusEmpty,
  StatusError,
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
        // Stamp: ignore stale responses after period switch (abort may lag).
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
        // Silent poll keeps prior data on error; non-silent may still be empty.
        if (!silent) setReady(true)
      } finally {
        if (!silent && !signal?.aborted) setLoading(false)
      }
    },
    [s.loadError],
  )

  // Period change: clear data so skeleton and stale cards never dual-render.
  useEffect(() => {
    const ctrl = new AbortController()
    setReady(false)
    setItems([])
    setUpdatedAt(null)
    setError(null)
    void load(false, ctrl.signal, period)
    return () => ctrl.abort()
  }, [period, load])

  // Silent refresh: abort in-flight polls when period changes or unmount.
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

  const cardLabels = useMemo(
    () => ({
      latency: s.latency,
      ping: s.ping,
      availability: `${s.availability} · ${s.period[period]}`,
      past: s.past,
      now: s.now,
      status: statusLabel,
      extraModels: (n: number) => s.extraModels.replace('{n}', String(n)),
    }),
    [s, period, statusLabel],
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

  const overallLabel = overall === 'operational' ? s.overall.operational : s.overall.degraded
  // One source of truth: never show data while !ready (period switch clears items too).
  const showSkeleton = !ready || (loading && items.length === 0)
  const showError = ready && !loading && Boolean(error) && items.length === 0
  const showEmpty = ready && !loading && !error && items.length === 0
  const showData = ready && items.length > 0

  return (
    <div className="bx-status-grid min-h-[70vh]">
      <div className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
        <header className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
              <span className="h-px w-5 bg-[var(--bx-brand)]" />
              {s.eyebrow}
            </p>
            <h1 className="mt-3.5 text-[32px] font-extrabold tracking-tight sm:text-[40px]">
              {s.title}
            </h1>
            <p className="mt-2.5 max-w-xl text-[14.5px] text-[var(--bx-text-muted)] sm:text-[15px]">
              {s.subtitle}
            </p>
            {updatedAt ? (
              <p className="mt-2 font-mono text-[11px] text-[var(--bx-text-dim)]">
                {s.updatedAt.replace('{time}', new Date(updatedAt).toLocaleString())}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PeriodPills period={period} options={periodOptions} onChange={setPeriod} />
            {ready ? <OverallChip overall={overall} label={overallLabel} /> : null}
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--bx-text-dim)] transition hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)] disabled:opacity-50"
              disabled={loading}
              title={s.refresh}
              onClick={() => void load(false, undefined, period)}
            >
              <RefreshCw size={16} className={cx(loading && 'animate-spin')} />
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
          <div className="space-y-2">
            {grouped.ungrouped.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {grouped.ungrouped.map((item) => (
                  <MonitorStatusCard key={item.id} item={item} labels={cardLabels} />
                ))}
              </div>
            ) : null}
            {[...grouped.map.entries()].map(([name, list]) => (
              <GroupPanel key={name} name={name}>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((item) => (
                    <MonitorStatusCard key={item.id} item={item} labels={cardLabels} />
                  ))}
                </div>
              </GroupPanel>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
