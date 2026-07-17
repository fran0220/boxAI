import type { ReactNode } from 'react'
import {
  formatAvailability,
  formatLatency,
  hslForPct,
  providerLabel,
  statusBadgeClass,
  timelineHeight,
  timelineSegClass,
  type MonitorStatus,
  type OverallStatus,
  type PublicStatusItem,
  type PublicTimelinePoint,
  type StatusPeriod,
} from '@/lib/public-status'
import { cx } from '@/lib/cx'

export function StatusCorners() {
  return (
    <>
      <span className="bx-status-corner bx-status-corner--tl" aria-hidden />
      <span className="bx-status-corner bx-status-corner--tr" aria-hidden />
      <span className="bx-status-corner bx-status-corner--bl" aria-hidden />
      <span className="bx-status-corner bx-status-corner--br" aria-hidden />
    </>
  )
}

export function OverallChip({ overall, label }: { overall: OverallStatus; label: string }) {
  return (
    <span className={cx('bx-status-overall', overall === 'operational' ? 'bx-status-overall--ok' : 'bx-status-overall--degraded')}>
      <span className="bx-status-overall__dot" />
      {label}
    </span>
  )
}

export function PeriodPills({
  period,
  options,
  onChange,
}: {
  period: StatusPeriod
  options: { value: StatusPeriod; label: string }[]
  onChange: (p: StatusPeriod) => void
}) {
  return (
    <div className="bx-status-period" role="tablist" aria-label="Period">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={period === opt.value}
          className={period === opt.value ? 'is-active' : undefined}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function StatusTimeline({
  points,
  length = 60,
  pastLabel,
  nowLabel,
  statusLabel,
}: {
  points: PublicTimelinePoint[]
  length?: number
  pastLabel: string
  nowLabel: string
  statusLabel: (s: MonitorStatus) => string
}) {
  const real = [...(points ?? [])].slice(0, length).reverse()
  const pad = Math.max(0, length - real.length)
  const bars: { cls: string; h: number; title: string }[] = []
  for (let i = 0; i < pad; i++) {
    bars.push({ cls: 'bx-status-timeline__seg--empty', h: 15, title: '' })
  }
  for (const p of real) {
    bars.push({
      cls: timelineSegClass(p.status),
      h: timelineHeight(p.status),
      title: `${p.checked_at} · ${statusLabel(p.status)} · ${formatLatency(p.latency_ms)}ms`,
    })
  }
  return (
    <div className="mt-4 pt-3 border-t border-[var(--bx-border)]">
      <div className="bx-status-timeline" aria-hidden>
        {bars.map((b, i) => (
          <div
            key={i}
            className={cx('bx-status-timeline__seg', b.cls)}
            style={{ height: `${b.h}%` }}
            title={b.title}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] uppercase tracking-widest text-[var(--bx-text-dim)]">
        <span>{pastLabel}</span>
        <span>{nowLabel}</span>
      </div>
    </div>
  )
}

export function MonitorStatusCard({
  item,
  labels,
  onClick,
}: {
  item: PublicStatusItem
  labels: {
    latency: string
    ping: string
    availability: string
    past: string
    now: string
    status: (s: MonitorStatus) => string
    extraModels: (n: number) => string
  }
  onClick?: () => void
}) {
  const availColor = hslForPct(item.availability)
  const extras = item.extra_models?.length ?? 0
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      className={cx('bx-status-card p-5 text-left', onClick && 'cursor-pointer')}
      onClick={onClick}
    >
      <StatusCorners />
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-[var(--bx-radius-xl)] bg-[var(--bx-bg-muted)] ring-1 ring-white/10 text-sm font-semibold text-[var(--bx-brand)]">
          {(item.provider || '?').slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-[var(--bx-text)]">{item.name}</div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <span className="rounded-md bg-[var(--bx-bg-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--bx-text-muted)]">
              {providerLabel(item.provider)}
            </span>
            <span className="truncate font-mono text-xs text-[var(--bx-text-dim)]">{item.primary_model}</span>
          </div>
        </div>
        <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', statusBadgeClass(item.status))}>
          {labels.status(item.status)}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <MetricTile label={labels.latency} value={formatLatency(item.latency_ms)} unit="ms" />
        <MetricTile label={labels.ping} value={formatLatency(item.ping_latency_ms)} unit="ms" />
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-[var(--bx-border)] pt-3">
        <div className="text-[11px] uppercase tracking-widest text-[var(--bx-text-dim)]">{labels.availability}</div>
        <div className="flex items-baseline gap-0.5">
          <span className="bx-status-metric-value text-3xl leading-none" style={availColor ? { color: availColor } : undefined}>
            {formatAvailability(item.availability)}
          </span>
          <span className="text-base font-semibold" style={availColor ? { color: availColor } : undefined}>
            %
          </span>
        </div>
      </div>
      {extras > 0 ? (
        <div className="mt-1 text-right text-[11px] text-[var(--bx-text-dim)]">{labels.extraModels(extras)}</div>
      ) : null}

      <StatusTimeline
        points={item.timeline || []}
        pastLabel={labels.past}
        nowLabel={labels.now}
        statusLabel={labels.status}
      />
    </Wrapper>
  )
}

function MetricTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-muted)] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--bx-text-dim)]">{label}</div>
      <div className="bx-status-metric-value mt-1.5 text-lg text-[var(--bx-text)]">
        {value}
        <span className="ml-0.5 text-xs font-normal text-[var(--bx-text-dim)]">{unit}</span>
      </div>
    </div>
  )
}

export function StatusSkeleton() {
  return (
    <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bx-status-card min-h-[280px] animate-pulse p-5">
          <div className="flex gap-3">
            <div className="h-9 w-9 rounded-[var(--bx-radius-xl)] bg-[var(--bx-bg-muted)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-[var(--bx-bg-muted)]" />
              <div className="h-3 w-1/2 rounded bg-[var(--bx-bg-muted)]" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="h-16 rounded-[var(--bx-radius-xl)] bg-[var(--bx-bg-muted)]" />
            <div className="h-16 rounded-[var(--bx-radius-xl)] bg-[var(--bx-bg-muted)]" />
          </div>
          <div className="mt-6 h-5 w-full rounded bg-[var(--bx-bg-muted)]" />
        </div>
      ))}
    </div>
  )
}

export function StatusEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="bx-empty-state">
      <strong className="text-[var(--bx-text)]">{title}</strong>
      <p className="max-w-sm text-sm text-[var(--bx-text-muted)]">{description}</p>
    </div>
  )
}

export function StatusError({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div className="bx-empty-state border-[var(--bx-danger-border)] bg-[var(--bx-danger-soft)]">
      <strong className="text-[var(--bx-danger)]">{message}</strong>
      <button type="button" className="bx-btn bx-btn-ghost mt-2" onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  )
}

export function GroupPanel({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="bx-status-group">
      <h2 className="bx-status-group__title">{name}</h2>
      {children}
    </section>
  )
}
