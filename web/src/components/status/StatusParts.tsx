import type { ReactNode } from 'react'
import {
  formatAvailability,
  formatLatency,
  providerLabel,
  timelineHeight,
  timelineSegClass,
  type MonitorStatus,
  type OverallStatus,
  type PublicStatusItem,
  type PublicTimelinePoint,
  type StatusPeriod,
} from '@/lib/public-status'
import { cx } from '@/lib/cx'

export function OverallChip({ overall, label }: { overall: OverallStatus; label: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-[7px] rounded-md border px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.1em]',
        overall === 'operational'
          ? 'border-[color-mix(in_srgb,var(--bx-success)_35%,transparent)] text-[var(--bx-success)]'
          : 'border-[color-mix(in_srgb,var(--bx-warning)_35%,transparent)] text-[var(--bx-warning)]',
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-current"
        style={{ animation: 'bx-ping 1.8s cubic-bezier(0,0,0.2,1) infinite' }}
      />
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
    <div
      className="inline-flex gap-0.5 rounded-lg border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] p-[3px]"
      role="tablist"
      aria-label="Period"
    >
      {options.map((opt) => {
        const active = period === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx(
              'cursor-pointer rounded-md border-0 px-3 py-[5px] font-mono text-[11.5px] font-medium transition-colors',
              active
                ? 'bg-[var(--bx-active)] font-semibold text-[var(--bx-brand-bright)]'
                : 'bg-transparent text-[var(--bx-text-dim)]',
            )}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function StatusTimeline({
  points,
  length = 60,
  pastLabel,
  nowLabel,
  statusLabel,
  compact = false,
}: {
  points: PublicTimelinePoint[]
  length?: number
  pastLabel: string
  nowLabel: string
  statusLabel: (s: MonitorStatus) => string
  /** Inline row timeline (no top border). */
  compact?: boolean
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
    <div className={compact ? undefined : 'mt-4 border-t border-[var(--bx-border)] pt-3'}>
      <div
        className="flex h-[22px] w-full items-end gap-0.5"
        aria-hidden
      >
        {bars.map((b, i) => (
          <div
            key={i}
            className={cx(
              'min-w-[2px] flex-1 origin-bottom rounded-[1.5px]',
              b.cls,
            )}
            style={{
              height: `${b.h}%`,
              animation: `bx-bar-grow 0.7s var(--bx-ease) both ${(i * 0.008).toFixed(3)}s`,
            }}
            title={b.title}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[8.5px] tracking-[0.18em] text-[var(--bx-text-dim)]">
        <span>{pastLabel}</span>
        <span>{nowLabel}</span>
      </div>
    </div>
  )
}

function availColorClass(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return 'text-[var(--bx-text)]'
  if (pct >= 99) return 'text-[var(--bx-success)]'
  if (pct >= 97) return 'text-[var(--bx-warning)]'
  return 'text-[var(--bx-danger)]'
}

function statusBadgeStyles(status: MonitorStatus): string {
  switch (status) {
    case 'operational':
      return 'bg-[var(--bx-success-soft)] text-[var(--bx-success)]'
    case 'degraded':
      return 'bg-[var(--bx-warning-soft)] text-[var(--bx-warning)]'
    case 'failed':
    case 'error':
      return 'bg-[var(--bx-danger-soft)] text-[var(--bx-danger)]'
    default:
      return 'bg-[var(--bx-bg-muted)] text-[var(--bx-text-dim)]'
  }
}

/** Design row monitor: name | timeline | latency | ping | availability */
export function MonitorStatusRow({
  item,
  labels,
}: {
  item: PublicStatusItem
  labels: {
    latency: string
    ping: string
    availability: string
    past: string
    now: string
    status: (s: MonitorStatus) => string
  }
}) {
  const initial = (item.provider || '?').slice(0, 1).toUpperCase()
  return (
    <div className="grid grid-cols-1 items-center gap-4 border-t border-[var(--bx-line)] px-[22px] py-4 transition-colors first:border-t-0 hover:bg-[var(--bx-hover)] lg:grid-cols-[250px_1fr_120px_120px_110px] lg:gap-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg bg-[var(--bx-brand-soft)] font-mono text-[13px] font-semibold text-[var(--bx-brand)]">
          {initial}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
            <span className="truncate">{item.name}</span>
            <span
              className={cx(
                'rounded px-[7px] py-px font-mono text-[9.5px] font-semibold tracking-[0.06em]',
                statusBadgeStyles(item.status),
              )}
            >
              {labels.status(item.status)}
            </span>
          </span>
          <span className="mt-0.5 block truncate font-mono text-[11px] text-[var(--bx-text-dim)]">
            {providerLabel(item.provider)} · {item.primary_model}
          </span>
        </span>
      </div>

      <div className="min-w-0">
        <StatusTimeline
          points={item.timeline || []}
          pastLabel={labels.past}
          nowLabel={labels.now}
          statusLabel={labels.status}
          compact
        />
      </div>

      <div className="text-left lg:text-right">
        <p className="m-0 font-mono text-[10px] tracking-[0.1em] text-[var(--bx-text-dim)] uppercase">
          {labels.latency}
        </p>
        <p className="mt-[3px] font-mono text-[15px] font-semibold tabular-nums">
          {formatLatency(item.latency_ms)}
          <span className="text-[11px] text-[var(--bx-text-dim)]"> ms</span>
        </p>
      </div>
      <div className="text-left lg:text-right">
        <p className="m-0 font-mono text-[10px] tracking-[0.1em] text-[var(--bx-text-dim)] uppercase">
          {labels.ping}
        </p>
        <p className="mt-[3px] font-mono text-[15px] font-semibold tabular-nums">
          {formatLatency(item.ping_latency_ms)}
          <span className="text-[11px] text-[var(--bx-text-dim)]"> ms</span>
        </p>
      </div>
      <div className="text-left lg:text-right">
        <p className="m-0 font-mono text-[10px] tracking-[0.1em] text-[var(--bx-text-dim)] uppercase">
          {labels.availability}
        </p>
        <p
          className={cx(
            'mt-[3px] font-mono text-[19px] font-semibold tabular-nums',
            availColorClass(item.availability),
          )}
        >
          {formatAvailability(item.availability)}
          <span className="text-xs">%</span>
        </p>
      </div>
    </div>
  )
}

export function StatusKpiStrip({
  items,
}: {
  items: { label: string; value: string; valueClass?: string; unit?: string }[]
}) {
  return (
    <section
      data-screen-label="状态KPI"
      className="mt-8 grid overflow-hidden rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] shadow-[var(--bx-shadow-card)] sm:grid-cols-2 lg:grid-cols-4"
    >
      {items.map((kpi, i) => (
        <div
          key={kpi.label}
          className={cx(
            'px-[22px] py-[18px]',
            i > 0 && 'border-t border-[var(--bx-border)] sm:border-t-0',
            i % 2 === 1 && 'sm:border-l sm:border-[var(--bx-border)]',
            i >= 2 && 'lg:border-l lg:border-[var(--bx-border)]',
            i === 2 && 'sm:border-t sm:border-[var(--bx-border)] lg:border-t-0',
            i === 3 && 'sm:border-t sm:border-[var(--bx-border)] lg:border-t-0',
          )}
        >
          <p className="m-0 font-mono text-[10.5px] tracking-[0.14em] text-[var(--bx-text-dim)] uppercase">
            {kpi.label}
          </p>
          <p
            className={cx(
              'mt-1.5 font-mono text-[26px] font-semibold tabular-nums',
              kpi.valueClass,
            )}
          >
            {kpi.value}
            {kpi.unit ? (
              <span className="text-[13px] text-[var(--bx-text-dim)]">{kpi.unit}</span>
            ) : null}
          </p>
        </div>
      ))}
    </section>
  )
}

export function StatusSkeleton() {
  return (
    <div className="mt-8 space-y-10">
      <div className="grid animate-pulse overflow-hidden rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cx('px-[22px] py-[18px]', i > 0 && 'sm:border-l sm:border-[var(--bx-border)]')}
          >
            <div className="h-2.5 w-20 rounded bg-[var(--bx-bg-muted)]" />
            <div className="mt-3 h-7 w-16 rounded bg-[var(--bx-bg-muted)]" />
          </div>
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g}>
          <div className="mb-3.5 h-3 w-28 animate-pulse rounded bg-[var(--bx-bg-muted)]" />
          <div className="overflow-hidden rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex animate-pulse items-center gap-5 border-t border-[var(--bx-line)] px-[22px] py-4 first:border-t-0"
              >
                <div className="h-[34px] w-[34px] rounded-lg bg-[var(--bx-bg-muted)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/3 rounded bg-[var(--bx-bg-muted)]" />
                  <div className="h-2.5 w-1/4 rounded bg-[var(--bx-bg-muted)]" />
                </div>
                <div className="hidden h-[22px] flex-1 rounded bg-[var(--bx-bg-muted)] lg:block" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function StatusEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="bx-empty-state mt-8">
      <strong className="text-[var(--bx-text)]">{title}</strong>
      <p className="max-w-sm text-sm text-[var(--bx-text-muted)]">{description}</p>
    </div>
  )
}

export function StatusError({
  message,
  retryLabel,
  onRetry,
}: {
  message: string
  retryLabel: string
  onRetry: () => void
}) {
  return (
    <div className="bx-empty-state mt-8 border-[var(--bx-danger-border)] bg-[var(--bx-danger-soft)]">
      <strong className="text-[var(--bx-danger)]">{message}</strong>
      <button type="button" className="bx-btn bx-btn-ghost mt-2" onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  )
}

export function GroupPanel({
  name,
  count,
  children,
}: {
  name: string
  count?: string
  children: ReactNode
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-3.5 flex items-center gap-2.5 font-mono text-[11px] font-semibold tracking-[0.16em] text-[var(--bx-text-dim)] uppercase">
        {name}
        <span className="h-px flex-1 bg-[var(--bx-border)]" />
        {count ? <span className="text-[var(--bx-text-dim)]">{count}</span> : null}
      </h2>
      <div className="overflow-hidden rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] shadow-[var(--bx-shadow-card)]">
        {children}
      </div>
    </section>
  )
}
