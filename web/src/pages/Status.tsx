import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overall, setOverall] = useState<OverallStatus>('operational')
  const [items, setItems] = useState<PublicStatusItem[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const load = useCallback(
    async (silent = false, signal?: AbortSignal) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        const data = await fetchPublicStatus(period, signal)
        setItems(data.items || [])
        setOverall(data.overall === 'degraded' ? 'degraded' : 'operational')
        setUpdatedAt(data.updated_at)
      } catch (e) {
        if (signal?.aborted) return
        setError(e instanceof Error ? e.message : s.loadError)
      } finally {
        if (!silent && !signal?.aborted) setLoading(false)
      }
    },
    [period, s.loadError],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    void load(false, ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  useEffect(() => {
    const t = window.setInterval(() => {
      void load(true)
    }, 45_000)
    return () => window.clearInterval(t)
  }, [load])

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

  return (
    <div className="bx-status-grid min-h-[70vh]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Hero */}
        <header className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="bx-display text-xs font-medium tracking-[0.14em] text-[var(--bx-text-dim)] uppercase">
              {s.eyebrow}
            </p>
            <h1 className="bx-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{s.title}</h1>
            <p className="mt-2 max-w-xl text-sm text-[var(--bx-text-muted)] sm:text-base">{s.subtitle}</p>
            {updatedAt ? (
              <p className="mt-2 text-xs text-[var(--bx-text-dim)]">
                {s.updatedAt.replace('{time}', new Date(updatedAt).toLocaleString())}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PeriodPills period={period} options={periodOptions} onChange={setPeriod} />
            <OverallChip overall={overall} label={overallLabel} />
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--bx-text-dim)] transition hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)] disabled:opacity-50"
              disabled={loading}
              title={s.refresh}
              onClick={() => void load(false)}
            >
              <RefreshCw size={16} className={cx(loading && 'animate-spin')} />
            </button>
          </div>
        </header>

        {loading && items.length === 0 ? <StatusSkeleton /> : null}
        {!loading && error ? (
          <StatusError message={error || s.loadError} retryLabel={s.retry} onRetry={() => void load(false)} />
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <StatusEmpty title={s.emptyTitle} description={s.emptyBody} />
        ) : null}

        {!error && items.length > 0 ? (
          <div className="space-y-2">
            {grouped.ungrouped.length > 0 ? (
              <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {grouped.ungrouped.map((item) => (
                  <MonitorStatusCard key={item.id} item={item} labels={cardLabels} />
                ))}
              </div>
            ) : null}
            {[...grouped.map.entries()].map(([name, list]) => (
              <GroupPanel key={name} name={name}>
                <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
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
