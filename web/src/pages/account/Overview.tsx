import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, LogOut } from 'lucide-react'
import { ensureCreatorKey, logout, ApiError } from '@/lib/api'
import {
  getProfile,
  getUsageDashboardModels,
  getUsageDashboardStats,
  getUsageDashboardTrend,
  listKeys,
  listUsage,
  type ApiKey,
  type UsageLog,
  type UsageModelStat,
  type UsageTrendPoint,
  type UserDashboardStats,
  type UserProfile,
} from '@/lib/customer-api'
import { useAuth } from '@/lib/use-auth'
import { usePageMeta } from '@/lib/meta'
import { useI18n } from '@/i18n'
import { Spinner } from '@/components/ui/Spinner'

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function lastNDaysRange(n: number): { start_date: string; end_date: string } {
  const end = new Date()
  const start = new Date(end.getTime() - (n - 1) * 24 * 60 * 60 * 1000)
  return { start_date: formatLocalDate(start), end_date: formatLocalDate(end) }
}

function trendTokens(p: UsageTrendPoint): number {
  return Number(p.total_tokens ?? p.tokens ?? 0)
}

function modelTokens(m: UsageModelStat): number {
  return Number(m.total_tokens ?? m.tokens ?? 0)
}

function modelCost(m: UsageModelStat): number {
  return Number(m.actual_cost ?? m.cost ?? 0)
}

function shortDate(iso: string): string {
  if (!iso) return ''
  // Accept YYYY-MM-DD or full ISO
  const part = iso.slice(5, 10)
  return part || iso
}

export function AccountOverview() {
  const { d } = useI18n()
  const t = d.account
  usePageMeta(t.metaTitle)
  const { user: sessionUser } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<UserDashboardStats | null>(null)
  const [trend, setTrend] = useState<UsageTrendPoint[]>([])
  const [models, setModels] = useState<UsageModelStat[]>([])
  const [recent, setRecent] = useState<UsageLog[]>([])
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [keyInfo, setKeyInfo] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const range = lastNDaysRange(14)
    ;(async () => {
      try {
        const [p, s, tr, md, usage, keyList] = await Promise.all([
          getProfile(),
          getUsageDashboardStats().catch(() => null),
          getUsageDashboardTrend({
            start_date: range.start_date,
            end_date: range.end_date,
            granularity: 'day',
          }).catch(() => null),
          getUsageDashboardModels({
            start_date: range.start_date,
            end_date: range.end_date,
          }).catch(() => null),
          listUsage(1, 6, { sort_by: 'created_at', sort_order: 'desc' }).catch(() => null),
          listKeys(1, 50).catch(() => null),
        ])
        if (cancelled) return
        setProfile(p)
        if (s) setStats(s)
        setTrend(tr?.trend || [])
        setModels((md?.models || []).slice(0, 6))
        setRecent(usage?.items || [])
        setKeys(keyList?.items || [])
        try {
          const key = await ensureCreatorKey()
          if (!cancelled) {
            setKeyInfo(`${key.created ? t.keyCreated : t.keyReady} · ${key.name}`)
          }
        } catch {
          /* key optional for overview chrome */
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t.loadFailed)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  async function onLogout() {
    await logout()
    window.location.href = '/'
  }

  const email = profile?.email || (sessionUser?.email as string) || '—'
  const username = profile?.username || (sessionUser?.username as string) || '—'
  const balance = profile?.balance

  const maxTokens = useMemo(() => {
    if (!trend.length) return 1
    return Math.max(1, ...trend.map(trendTokens))
  }, [trend])

  const trendStart = trend[0]?.date ? shortDate(String(trend[0].date)) : ''
  const trendEnd = trend.length ? shortDate(String(trend[trend.length - 1]?.date || '')) : ''

  // Spend from loaded trend window (14d) — i18n must say "近14天" / "Last 14d", not "本月"
  const spend14d = useMemo(() => {
    if (!trend.length) return null
    const sum = trend.reduce((acc, p) => acc + Number(p.actual_cost ?? p.cost ?? 0), 0)
    return sum
  }, [trend])

  // Δ% day-over-day only when last two trend points both have real request counts
  const reqDelta = useMemo(() => {
    if (trend.length < 2) return null
    const a = Number(trend[trend.length - 2]?.requests)
    const b = Number(trend[trend.length - 1]?.requests)
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return null
    return Math.round(((b - a) / a) * 100)
  }, [trend])

  const quotaExhausted = useMemo(
    () => keys.filter((k) => k.status === 'quota_exhausted').length,
    [keys],
  )

  const showRecentCalls = recent.length > 0

  if (!ready && !error) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="bx-account-page-title">{d.accountNav.overview}</h1>
        {keyInfo ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--bx-success)]">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {keyInfo}
          </span>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-[var(--bx-danger)]">{error}</p> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="bx-account-panel-grad">
          <div className="flex items-center justify-between gap-2">
            <p className="bx-account-mono-label">{t.balanceUniversal}</p>
            <Link
              to="/checkout"
              className="rounded-[6px] bg-[var(--bx-grad-cta)] px-3 py-1 text-xs font-bold text-[var(--bx-ink)] transition hover:-translate-y-px"
            >
              {t.billing}
            </Link>
          </div>
          <p className="bx-account-stat-value bx-account-stat-value--lg">
            {typeof balance === 'number' ? `$${balance.toFixed(2)}` : '—'}
          </p>
          <p className="bx-account-stat-hint">
            {spend14d != null
              ? t.monthSpendHint.replace('{cost}', `$${spend14d.toFixed(2)}`)
              : `${username} · ${email}`}
          </p>
        </div>

        <div className="bx-account-panel bx-account-panel-pad">
          <p className="bx-account-mono-label">{t.statTodayReq}</p>
          <p className="bx-account-stat-value">{stats ? formatNum(stats.today_requests) : '—'}</p>
          <p
            className="bx-account-stat-hint"
            style={{
              color:
                reqDelta != null && reqDelta > 0
                  ? 'var(--bx-success)'
                  : reqDelta != null && reqDelta < 0
                    ? 'var(--bx-danger)'
                    : undefined,
            }}
          >
            {reqDelta != null
              ? `${reqDelta >= 0 ? '▲' : '▼'} ${Math.abs(reqDelta)}% ${t.vsYesterday}`
              : stats
                ? `$${Number(stats.today_actual_cost ?? stats.today_cost ?? 0).toFixed(2)}`
                : '—'}
          </p>
        </div>

        <div className="bx-account-panel bx-account-panel-pad">
          <p className="bx-account-mono-label">{t.statTodayTokens}</p>
          <p className="bx-account-stat-value">{stats ? formatNum(stats.today_tokens) : '—'}</p>
          <p className="bx-account-stat-hint">
            {stats
              ? t.statTotalTokensHint.replace('{n}', formatNum(stats.total_tokens))
              : '—'}
          </p>
        </div>

        <div className="bx-account-panel bx-account-panel-pad">
          <p className="bx-account-mono-label">{t.statKeys}</p>
          <p className="bx-account-stat-value">
            {stats ? (
              <>
                {stats.active_api_keys}
                <span className="text-[15px] text-[var(--bx-text-dim)]">/{stats.total_api_keys}</span>
              </>
            ) : (
              '—'
            )}
          </p>
          <p
            className="bx-account-stat-hint"
            style={{ color: quotaExhausted > 0 ? 'var(--bx-warning)' : undefined }}
          >
            {quotaExhausted > 0
              ? t.quotaExhaustedHint.replace('{n}', String(quotaExhausted))
              : stats
                ? t.statCostShort.replace(
                    '{cost}',
                    `$${Number(stats.total_actual_cost ?? stats.total_cost ?? 0).toFixed(2)}`,
                  )
                : '—'}
          </p>
        </div>
      </div>

      {/* 14d usage chart */}
      <div className="bx-account-panel bx-account-panel-pad mt-3">
        <div className="flex items-center justify-between">
          <p className="m-0 text-[13.5px] font-bold">{t.trend14d}</p>
          <span className="font-mono text-[11px] text-[var(--bx-text-dim)]">{t.trendUnit}</span>
        </div>
        {trend.length === 0 ? (
          <p className="bx-account-empty py-10">{t.noTrend}</p>
        ) : (
          <>
            <div className="bx-account-bar-chart mt-3.5">
              {trend.map((bar, i) => {
                const tokens = trendTokens(bar)
                const h = Math.max(4, Math.round((tokens / maxTokens) * 100))
                const label = String(bar.date || i)
                return (
                  <div
                    key={`${label}-${i}`}
                    className="bx-account-bar"
                    title={`${label}: ${formatNum(tokens)} tokens`}
                  >
                    <i
                      style={{
                        height: `${h}%`,
                        animation: `bx-bar-grow 0.8s var(--bx-ease) both ${i * 30}ms`,
                      }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-[var(--bx-text-dim)]">
              <span>{trendStart}</span>
              <span>{trendEnd}</span>
            </div>
          </>
        )}
      </div>

      {/* recent calls (or models fallback) + quick links */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="bx-account-panel">
          <p className="m-0 px-5 pt-3.5 pb-2.5 text-[13.5px] font-bold">
            {showRecentCalls ? t.recentCalls : t.recentModels}
          </p>
          {showRecentCalls ? (
            <ul className="m-0 list-none p-0">
              {recent.map((row) => (
                <li
                  key={row.id}
                  className="grid grid-cols-[1fr_90px_80px] items-center gap-3 border-t border-[var(--bx-line)] px-5 py-2.5 text-[12.5px]"
                >
                  <span className="truncate font-mono text-[11.5px] text-[var(--bx-text-soft)]">
                    {row.model || '—'}
                  </span>
                  <span className="text-right font-mono text-[11px] text-[var(--bx-text-dim)]">
                    {row.total_tokens != null ? formatNum(row.total_tokens) : '—'}
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums">
                    ${Number(row.actual_cost ?? row.total_cost ?? 0).toFixed(4)}
                  </span>
                </li>
              ))}
            </ul>
          ) : models.length === 0 ? (
            <p className="bx-account-empty">{t.noModels}</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {models.map((m) => (
                <li
                  key={m.model}
                  className="grid grid-cols-[1fr_90px_80px] items-center gap-3 border-t border-[var(--bx-line)] px-5 py-2.5 text-[12.5px]"
                >
                  <span className="truncate font-mono text-[11.5px] text-[var(--bx-text-soft)]">
                    {m.model}
                  </span>
                  <span className="text-right font-mono text-[11px] text-[var(--bx-text-dim)]">
                    {formatNum(modelTokens(m))}
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums">
                    ${modelCost(m).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Link to="/app/create/image" className="bx-account-quick-link">
            <span>{t.goCreator}</span>
            <ArrowRight size={14} className="text-[var(--bx-brand)]" />
          </Link>
          <Link to="/app/developer/keys" className="bx-account-quick-link">
            <span>{t.manageKeys}</span>
            <ArrowRight size={14} className="text-[var(--bx-brand)]" />
          </Link>
          <Link to="/app/agent" className="bx-account-quick-link">
            <span>{t.goStudio}</span>
            <ArrowRight size={14} className="text-[var(--bx-brand)]" />
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="mt-8 inline-flex items-center gap-2 text-sm text-[var(--bx-text-dim)] transition hover:text-[var(--bx-danger)]"
      >
        <LogOut size={15} />
        {d.nav.logout}
      </button>
    </div>
  )
}
