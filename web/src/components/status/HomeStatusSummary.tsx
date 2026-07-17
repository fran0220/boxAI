import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Activity } from 'lucide-react'
import { useI18n } from '@/i18n'
import {
  fetchPublicStatus,
  formatAvailability,
  hslForPct,
  providerLabel,
  statusBadgeClass,
  type OverallStatus,
  type PublicStatusItem,
} from '@/lib/public-status'
import { OverallChip, StatusCorners } from './StatusParts'
import { cx } from '@/lib/cx'
import { Reveal } from '@/components/motion/Reveal'

/** Lightweight homepage status strip — not a full dashboard (LCP-friendly). */
export function HomeStatusSummary() {
  const { d } = useI18n()
  const s = d.status
  const [overall, setOverall] = useState<OverallStatus>('operational')
  const [items, setItems] = useState<PublicStatusItem[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setFailed(false)
    fetchPublicStatus('7d', ctrl.signal)
      .then((data) => {
        setOverall(data.overall === 'degraded' ? 'degraded' : 'operational')
        setItems((data.items || []).slice(0, 4))
        setReady(true)
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setFailed(true)
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })
    return () => ctrl.abort()
  }, [])

  // Hide on fetch failure or successful empty fleet (no fake loading wall).
  if (failed) return null
  if (ready && !loading && items.length === 0) return null

  const overallLabel = overall === 'operational' ? s.overall.operational : s.overall.degraded

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="bx-display flex items-center gap-2 text-xs font-medium tracking-[0.12em] text-[var(--bx-text-dim)] uppercase">
              <Activity size={13} className="text-[var(--bx-teal)]" />
              {s.eyebrow}
            </p>
            <h2 className="bx-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{s.homeTitle}</h2>
            <p className="mt-2 max-w-lg text-sm text-[var(--bx-text-muted)]">{s.homeSubtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            {!loading ? <OverallChip overall={overall} label={overallLabel} /> : null}
            <Link
              to="/status"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--bx-brand-bright)] transition hover:text-[var(--bx-spark)]"
            >
              {s.viewAll}
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </Reveal>

      {loading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-[var(--bx-border)] bg-[var(--bx-bg-muted)]"
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const color = hslForPct(item.availability)
            return (
              <Link
                key={item.id}
                to="/status"
                className="bx-status-card bx-status-card--compact relative p-4 transition hover:-translate-y-0.5"
              >
                <StatusCorners />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--bx-text)]">{item.name}</div>
                    <div className="mt-0.5 text-[11px] text-[var(--bx-text-dim)]">
                      {providerLabel(item.provider)}
                    </div>
                  </div>
                  <span
                    className={cx(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      statusBadgeClass(item.status),
                    )}
                  >
                    {s.statusLabel[(item.status as keyof typeof s.statusLabel) || 'unknown'] ||
                      s.statusLabel.unknown}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--bx-text-dim)]">
                    {s.availability}
                  </span>
                  <span className="bx-status-metric-value text-xl" style={color ? { color } : undefined}>
                    {formatAvailability(item.availability)}
                    <span className="text-xs font-normal">%</span>
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
