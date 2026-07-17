import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  getMyErrorDetail,
  getUsageDashboardModels,
  getUsageDashboardStats,
  getUsageDashboardTrend,
  listAvailableGroups,
  listKeys,
  listMyErrorRequests,
  listUsage,
  type ApiKey,
  type ApiKeyGroup,
  type UsageLog,
  type UsageModelStat,
  type UsageTrendPoint,
  type UserDashboardStats,
  type UserErrorRequest,
  type UserErrorRequestDetail,
} from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

type TabId = 'logs' | 'errors' | 'models'

type LogFilters = {
  api_key_id: string
  model: string
  group_id: string
  start_date: string
  end_date: string
}

type ErrorFilters = {
  api_key_id: string
  model: string
  category: string
  status_code: string
}

const PAGE_SIZE = 20
const EXPORT_PAGE_SIZE = 100
const EXPORT_MAX_ROWS = 2000
const ERROR_STATUS_CODES = [400, 401, 403, 404, 408, 413, 429, 499, 500, 502, 503, 504, 529] as const
const ERROR_CATEGORIES = [
  'auth',
  'rate_limit',
  'quota',
  'invalid_request',
  'service_unavailable',
  'upstream',
  'internal',
  'cyber',
] as const

function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function defaultDateRange(): { start_date: string; end_date: string } {
  const end = new Date()
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  return { start_date: formatLocalDate(start), end_date: formatLocalDate(end) }
}

function emptyLogFilters(): LogFilters {
  const range = defaultDateRange()
  return {
    api_key_id: '',
    model: '',
    group_id: '',
    start_date: range.start_date,
    end_date: range.end_date,
  }
}

function emptyErrorFilters(): ErrorFilters {
  return {
    api_key_id: '',
    model: '',
    category: '',
    status_code: '',
  }
}

function formatNum(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(Math.round(n * 100) / 100)
}

function formatCost(n: number | undefined | null, digits = 4): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `$${n.toFixed(digits)}`
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function logKeyName(row: UsageLog): string {
  return row.api_key_name || row.api_key?.name || '—'
}

function logGroupName(row: UsageLog): string {
  return row.group?.name || '—'
}

function logCost(row: UsageLog): number {
  return row.actual_cost ?? row.total_cost ?? 0
}

function trendTokens(p: UsageTrendPoint): number {
  return Number(p.total_tokens ?? p.tokens ?? 0)
}

function trendRequests(p: UsageTrendPoint): number {
  return Number(p.requests ?? 0)
}

function modelTokens(m: UsageModelStat): number {
  return Number(m.total_tokens ?? m.tokens ?? 0)
}

function modelCost(m: UsageModelStat): number {
  return Number(m.actual_cost ?? m.cost ?? 0)
}

function escapeCsv(value: unknown): string {
  if (value == null) return ''
  const str = String(value)
  const escaped = str.replace(/"/g, '""')
  if (/^[=+\-@\t\r]/.test(str)) return `"'${escaped}"`
  if (/[,"\n\r]/.test(str)) return `"${escaped}"`
  return str
}

function pageLabel(template: string, page: number, pages: number): string {
  return template.replace('{page}', String(page)).replace('{pages}', String(pages))
}

function buildLogQuery(filters: LogFilters) {
  return {
    api_key_id: filters.api_key_id ? Number(filters.api_key_id) : undefined,
    model: filters.model.trim() || undefined,
    group_id: filters.group_id ? Number(filters.group_id) : undefined,
    start_date: filters.start_date || undefined,
    end_date: filters.end_date || undefined,
    sort_by: 'created_at' as const,
    sort_order: 'desc' as const,
  }
}

function buildErrorQuery(filters: ErrorFilters, logFilters: LogFilters) {
  return {
    api_key_id: filters.api_key_id ? Number(filters.api_key_id) : undefined,
    model: filters.model.trim() || undefined,
    category: filters.category || undefined,
    status_code: filters.status_code ? Number(filters.status_code) : undefined,
    start_date: logFilters.start_date || undefined,
    end_date: logFilters.end_date || undefined,
    sort_by: 'created_at',
    sort_order: 'desc' as const,
  }
}

function granularityForRange(start: string, end: string): 'day' | 'hour' {
  if (!start || !end) return 'day'
  const startTime = new Date(`${start}T00:00:00`).getTime()
  const endTime = new Date(`${end}T00:00:00`).getTime()
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 'day'
  return Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)) <= 1 ? 'hour' : 'day'
}

export function AccountUsage() {
  const { d } = useI18n()
  const t = d.accountUsage
  usePageMeta(t.metaTitle)

  const [tab, setTab] = useState<TabId>('logs')
  const [stats, setStats] = useState<UserDashboardStats | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [groups, setGroups] = useState<ApiKeyGroup[]>([])

  const [logFilters, setLogFilters] = useState<LogFilters>(emptyLogFilters)
  const [appliedLogFilters, setAppliedLogFilters] = useState<LogFilters>(emptyLogFilters)
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [logPage, setLogPage] = useState(1)
  const [logPages, setLogPages] = useState(1)
  const [logTotal, setLogTotal] = useState(0)
  const [logsLoading, setLogsLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const [trend, setTrend] = useState<UsageTrendPoint[]>([])
  const [trendLoading, setTrendLoading] = useState(false)

  const [models, setModels] = useState<UsageModelStat[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)

  const [errorFilters, setErrorFilters] = useState<ErrorFilters>(emptyErrorFilters)
  const [appliedErrorFilters, setAppliedErrorFilters] = useState<ErrorFilters>(emptyErrorFilters)
  const [errors, setErrors] = useState<UserErrorRequest[]>([])
  const [errorPage, setErrorPage] = useState(1)
  const [errorPages, setErrorPages] = useState(1)
  const [errorsLoading, setErrorsLoading] = useState(false)

  const [detail, setDetail] = useState<UserErrorRequestDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [error, setError] = useState('')
  const [bootLoading, setBootLoading] = useState(true)

  const categoryLabel = useCallback(
    (code: string) => {
      const map = t.categories as Record<string, string>
      return map[code] || code || '—'
    },
    [t.categories],
  )

  // Bootstrap: stats + keys + groups (once)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setBootLoading(true)
      try {
        const [s, keyList, groupList] = await Promise.all([
          getUsageDashboardStats(),
          listKeys(1, 100).catch(() => null),
          listAvailableGroups().catch(() => [] as ApiKeyGroup[]),
        ])
        if (cancelled) return
        setStats(s)
        setKeys(keyList?.items || [])
        setGroups(Array.isArray(groupList) ? groupList : [])
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t.loadFailed)
      } finally {
        if (!cancelled) setBootLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t.loadFailed])

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    setError('')
    try {
      const res = await listUsage(logPage, PAGE_SIZE, buildLogQuery(appliedLogFilters))
      setLogs(res.items || [])
      setLogPages(res.pages || 1)
      setLogTotal(res.total || 0)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadFailed)
      setLogs([])
      setLogPages(1)
      setLogTotal(0)
    } finally {
      setLogsLoading(false)
    }
  }, [logPage, appliedLogFilters, t.loadFailed])

  const loadTrend = useCallback(async () => {
    setTrendLoading(true)
    try {
      const q = buildLogQuery(appliedLogFilters)
      const res = await getUsageDashboardTrend({
        start_date: q.start_date,
        end_date: q.end_date,
        api_key_id: q.api_key_id,
        model: q.model,
        group_id: q.group_id,
        granularity: granularityForRange(appliedLogFilters.start_date, appliedLogFilters.end_date),
      })
      setTrend(res.trend || [])
    } catch {
      setTrend([])
    } finally {
      setTrendLoading(false)
    }
  }, [appliedLogFilters])

  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    try {
      const q = buildLogQuery(appliedLogFilters)
      const res = await getUsageDashboardModels({
        start_date: q.start_date,
        end_date: q.end_date,
        api_key_id: q.api_key_id,
        model: q.model,
        group_id: q.group_id,
      })
      setModels(res.models || [])
    } catch {
      setModels([])
    } finally {
      setModelsLoading(false)
    }
  }, [appliedLogFilters])

  const loadErrors = useCallback(async () => {
    setErrorsLoading(true)
    setError('')
    try {
      const res = await listMyErrorRequests({
        page: errorPage,
        page_size: PAGE_SIZE,
        ...buildErrorQuery(appliedErrorFilters, appliedLogFilters),
      })
      setErrors(res.items || [])
      setErrorPages(res.pages || 1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.errorLoadFailed)
      setErrors([])
      setErrorPages(1)
    } finally {
      setErrorsLoading(false)
    }
  }, [errorPage, appliedErrorFilters, appliedLogFilters, t.errorLoadFailed])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  useEffect(() => {
    void loadTrend()
  }, [loadTrend])

  useEffect(() => {
    if (tab === 'models') void loadModels()
  }, [tab, loadModels])

  useEffect(() => {
    if (tab === 'errors') void loadErrors()
  }, [tab, loadErrors])

  function resetLogFilters() {
    const next = emptyLogFilters()
    setLogFilters(next)
    setAppliedLogFilters(next)
    setLogPage(1)
  }

  function resetErrorFilters() {
    const next = emptyErrorFilters()
    setErrorFilters(next)
    setAppliedErrorFilters(next)
    setErrorPage(1)
  }

  async function refreshAll() {
    setError('')
    try {
      const s = await getUsageDashboardStats()
      setStats(s)
    } catch {
      /* keep previous stats */
    }
    if (tab === 'logs') {
      await Promise.all([loadLogs(), loadTrend()])
    } else if (tab === 'models') {
      await loadModels()
    } else {
      await loadErrors()
    }
  }

  async function exportCsv() {
    if (exporting) return
    setExporting(true)
    setError('')
    try {
      const query = buildLogQuery(appliedLogFilters)
      const all: UsageLog[] = []
      let page = 1
      let totalPages = 1
      while (page <= totalPages && all.length < EXPORT_MAX_ROWS) {
        const res = await listUsage(page, EXPORT_PAGE_SIZE, query)
        all.push(...(res.items || []))
        totalPages = res.pages || 1
        if (!res.items?.length) break
        page += 1
      }
      const rows = all.slice(0, EXPORT_MAX_ROWS)
      const headers = [
        t.colTime,
        t.colKey,
        t.colModel,
        t.colGroup,
        t.colTokens,
        t.colCost,
        t.colDuration,
        t.colStream,
      ]
      const body = rows.map((row) =>
        [
          row.created_at || '',
          logKeyName(row),
          row.model || '',
          logGroupName(row),
          row.total_tokens ?? '',
          logCost(row),
          row.duration_ms ?? '',
          row.stream ? t.yes : t.no,
        ]
          .map(escapeCsv)
          .join(','),
      )
      const csv = [headers.map(escapeCsv).join(','), ...body].join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const start = appliedLogFilters.start_date || 'start'
      const end = appliedLogFilters.end_date || 'end'
      link.href = url
      link.download = `usage_${start}_to_${end}.csv`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.exportFailed)
    } finally {
      setExporting(false)
    }
  }

  async function openErrorDetail(id: number) {
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await getMyErrorDetail(id)
      setDetail(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.errorLoadFailed)
    } finally {
      setDetailLoading(false)
    }
  }

  const maxTrendTokens = useMemo(() => {
    if (!trend.length) return 1
    return Math.max(1, ...trend.map(trendTokens))
  }, [trend])

  const maxModelTokens = useMemo(() => {
    if (!models.length) return 1
    return Math.max(1, ...models.map(modelTokens))
  }, [models])

  if (bootLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="bx-account-page-title">{t.title}</h1>
        <div className="bx-account-toolbar">
          <input
            type="date"
            className="bx-account-input-sm font-mono text-[12.5px]"
            value={logFilters.start_date}
            onChange={(e) => {
              const next = { ...logFilters, start_date: e.target.value }
              setLogFilters(next)
              setAppliedLogFilters(next)
              setLogPage(1)
            }}
            aria-label={t.startDate}
          />
          <input
            type="date"
            className="bx-account-input-sm font-mono text-[12.5px]"
            value={logFilters.end_date}
            onChange={(e) => {
              const next = { ...logFilters, end_date: e.target.value }
              setLogFilters(next)
              setAppliedLogFilters(next)
              setLogPage(1)
            }}
            aria-label={t.endDate}
          />
          <button
            type="button"
            className="bx-btn bx-btn-ghost bx-btn-sm"
            onClick={() => void exportCsv()}
            disabled={exporting || logTotal === 0}
          >
            {exporting ? t.exporting : t.exportCsv}
          </button>
        </div>
      </div>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

      {/* Stats strip */}
      {stats ? (
        <div className="bx-account-stats-strip mt-5 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          <Card label={t.todayRequests} value={String(stats.today_requests ?? 0)} />
          <Card label={t.todayTokens} value={formatNum(stats.today_tokens)} />
          <Card label={t.todayCost} value={formatCost(stats.today_actual_cost ?? stats.today_cost)} />
          <Card label={t.totalCost} value={formatCost(stats.total_actual_cost ?? stats.total_cost, 2)} />
          <Card label={t.totalRequests} value={formatNum(stats.total_requests)} />
          <Card label={t.totalTokens} value={formatNum(stats.total_tokens)} />
        </div>
      ) : null}

      {/* Trend */}
      <section className="bx-account-panel bx-account-panel-pad mt-3">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-[13.5px] font-bold">{t.trend}</h3>
          <span className="font-mono text-[11px] text-[var(--bx-text-dim)]">
            {t.granularityLabel.replace(
              '{g}',
              granularityForRange(appliedLogFilters.start_date, appliedLogFilters.end_date) === 'hour'
                ? t.granularityHour
                : t.granularityDay,
            )}
          </span>
        </div>
        {trendLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : trend.length === 0 ? (
          <p className="bx-account-empty">{t.noTrend}</p>
        ) : (
          <>
            <div className="bx-account-bar-chart mt-3.5 h-[110px]">
              {trend.map((point, i) => {
                const tokens = trendTokens(point)
                const heightPct = Math.max(4, (tokens / maxTrendTokens) * 100)
                const label = point.date || String(i)
                return (
                  <div
                    key={`${label}-${i}`}
                    className="bx-account-bar"
                    title={`${label}: ${formatNum(tokens)} tokens · ${trendRequests(point)} req`}
                  >
                    <i
                      style={{
                        height: `${heightPct}%`,
                        maxWidth: 40,
                        animation: `bx-bar-grow 0.8s var(--bx-ease) both ${i * 30}ms`,
                      }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-[var(--bx-text-dim)]">
              <span>{String(trend[0]?.date || '').slice(5, 16) || String(trend[0]?.date || '')}</span>
              <span>
                {String(trend[trend.length - 1]?.date || '').slice(5, 16) ||
                  String(trend[trend.length - 1]?.date || '')}
              </span>
            </div>
          </>
        )}
      </section>

      {/* Tabs */}
      <div className="mt-5 flex gap-0.5 border-b border-[var(--bx-border)]">
        {(
          [
            ['logs', t.tabLogs],
            ['errors', t.tabErrors],
            ['models', t.tabModels],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`bx-account-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Compact secondary filters — design-first, dates already on toolbar */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {tab === 'errors' ? (
          <>
            <select
              className="bx-account-input-sm"
              value={errorFilters.category}
              onChange={(e) => {
                const next = { ...errorFilters, category: e.target.value }
                setErrorFilters(next)
                setAppliedErrorFilters(next)
                setErrorPage(1)
              }}
              aria-label={t.colCategory}
            >
              <option value="">{t.categories.all}</option>
              {ERROR_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
            <select
              className="bx-account-input-sm"
              value={errorFilters.status_code}
              onChange={(e) => {
                const next = { ...errorFilters, status_code: e.target.value }
                setErrorFilters(next)
                setAppliedErrorFilters(next)
                setErrorPage(1)
              }}
              aria-label={t.colStatus}
            >
              <option value="">{t.colStatus}</option>
              {ERROR_STATUS_CODES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <select
              className="bx-account-input-sm"
              value={logFilters.api_key_id}
              onChange={(e) => {
                const next = { ...logFilters, api_key_id: e.target.value }
                setLogFilters(next)
                setAppliedLogFilters(next)
                setLogPage(1)
              }}
              aria-label={t.colKey}
            >
              <option value="">{t.allKeys}</option>
              {keys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
            <input
              className="bx-account-input-sm w-[140px]"
              value={logFilters.model}
              onChange={(e) => setLogFilters((f) => ({ ...f, model: e.target.value }))}
              onBlur={() => {
                setAppliedLogFilters({ ...logFilters })
                setLogPage(1)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setAppliedLogFilters({ ...logFilters })
                  setLogPage(1)
                }
              }}
              placeholder={t.allModels}
              aria-label={t.colModel}
            />
            {groups.length > 0 ? (
              <select
                className="bx-account-input-sm"
                value={logFilters.group_id}
                onChange={(e) => {
                  const next = { ...logFilters, group_id: e.target.value }
                  setLogFilters(next)
                  setAppliedLogFilters(next)
                  setLogPage(1)
                }}
                aria-label={t.colGroup}
              >
                <option value="">{t.allGroups}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            ) : null}
          </>
        )}
        <button
          type="button"
          className="bx-account-outline-btn"
          onClick={() => {
            if (tab === 'errors') {
              resetErrorFilters()
            } else {
              resetLogFilters()
            }
          }}
        >
          {t.reset}
        </button>
        <button type="button" className="bx-account-outline-btn" onClick={() => void refreshAll()}>
          {t.refresh}
        </button>
      </div>

      {/* Tab content */}
      {tab === 'logs' ? (
        <div className="mt-3.5">
          {logsLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : logs.length === 0 ? (
            <div className="bx-account-panel">
              <p className="bx-account-empty">{t.empty}</p>
            </div>
          ) : (
            <div className="bx-account-table-wrap overflow-x-auto">
              <table className="bx-account-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>{t.colTime}</th>
                    <th>{t.colModel}</th>
                    <th>{t.colKey}</th>
                    <th className="text-right">{t.colTokens}</th>
                    <th className="text-right">{t.colCost}</th>
                    <th className="text-right">{t.colDuration}</th>
                    <th className="text-right">{t.colStream}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap font-mono text-[11px] text-[var(--bx-text-muted)]">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="max-w-[180px] truncate font-mono text-[11.5px] text-[var(--bx-text-soft)]">
                        {row.model || '—'}
                      </td>
                      <td className="text-[var(--bx-text-muted)]">{logKeyName(row)}</td>
                      <td className="num text-right">{row.total_tokens ?? '—'}</td>
                      <td className="num text-right">{formatCost(logCost(row), 4)}</td>
                      <td className="num text-right text-[var(--bx-text-muted)]">
                        {formatDuration(row.duration_ms)}
                      </td>
                      <td className="text-right">
                        {row.stream ? (
                          <span className="bx-account-stream-sse">SSE</span>
                        ) : (
                          <span className="bx-account-stream-off">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={logPage}
            pages={logPages}
            label={pageLabel(t.page, logPage, logPages)}
            prev={t.prev}
            next={t.next}
            onPrev={() => setLogPage((p) => Math.max(1, p - 1))}
            onNext={() => setLogPage((p) => p + 1)}
          />
        </div>
      ) : null}

      {tab === 'errors' ? (
        <div className="mt-3.5">
          {errorsLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : errors.length === 0 ? (
            <div className="bx-account-panel">
              <p className="bx-account-empty">{t.errorEmpty}</p>
            </div>
          ) : (
            <div className="bx-account-table-wrap overflow-x-auto">
              <table className="bx-account-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>{t.colTime}</th>
                    <th>{t.colModel}</th>
                    <th>{t.colKey}</th>
                    <th>{t.colStatus}</th>
                    <th>{t.colCategory}</th>
                    <th>{t.colMessage}</th>
                    <th>{t.detail}</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap font-mono text-[11px] text-[var(--bx-text-muted)]">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="font-mono text-[11.5px]">{row.model || '—'}</td>
                      <td className="text-[var(--bx-text-soft)]">
                        {row.key_name || '—'}
                        {row.key_deleted ? ' †' : ''}
                      </td>
                      <td className="num font-medium">{row.status_code}</td>
                      <td>{categoryLabel(row.category)}</td>
                      <td className="max-w-[240px] truncate text-[var(--bx-text-muted)]" title={row.message}>
                        {row.message || '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="bx-account-outline-btn"
                          onClick={() => void openErrorDetail(row.id)}
                        >
                          {t.detail}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={errorPage}
            pages={errorPages}
            label={pageLabel(t.page, errorPage, errorPages)}
            prev={t.prev}
            next={t.next}
            onPrev={() => setErrorPage((p) => Math.max(1, p - 1))}
            onNext={() => setErrorPage((p) => p + 1)}
          />
        </div>
      ) : null}

      {tab === 'models' ? (
        <div className="mt-3.5">
          {modelsLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : models.length === 0 ? (
            <div className="bx-account-panel">
              <p className="bx-account-empty">{t.noModels}</p>
            </div>
          ) : (
            <div className="bx-account-table-wrap overflow-x-auto">
              <table className="bx-account-table min-w-[560px]">
                <thead>
                  <tr>
                    <th>{t.colModel}</th>
                    <th className="text-right">{t.todayRequests}</th>
                    <th className="text-right">{t.colTokens}</th>
                    <th className="text-right">{t.colCost}</th>
                    <th className="w-[30%]"> </th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => {
                    const tokens = modelTokens(m)
                    const pct = Math.max(2, (tokens / maxModelTokens) * 100)
                    return (
                      <tr key={m.model}>
                        <td className="font-mono text-xs">{m.model || '—'}</td>
                        <td className="num text-right">{formatNum(m.requests)}</td>
                        <td className="num text-right">{formatNum(tokens)}</td>
                        <td className="num text-right">{formatCost(modelCost(m), 4)}</td>
                        <td>
                          <span className="bx-account-progress">
                            <i style={{ width: `${pct}%` }} />
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
      ) : null}

      {/* Error detail modal */}
      {(detail || detailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!detailLoading) setDetail(null)
          }}
        >
          <div
            className="bx-account-panel bx-account-panel-pad max-h-[85vh] w-full max-w-lg overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">{t.detail}</h3>
              <button
                type="button"
                className="bx-btn bx-btn-ghost bx-btn-sm"
                onClick={() => setDetail(null)}
                disabled={detailLoading}
              >
                {t.close}
              </button>
            </div>
            {detailLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : detail ? (
              <dl className="mt-4 space-y-3 text-sm">
                <DetailRow label={t.colTime}>
                  {detail.created_at ? new Date(detail.created_at).toLocaleString() : '—'}
                </DetailRow>
                <DetailRow label={t.colModel}>
                  <span className="font-mono text-xs">{detail.model || '—'}</span>
                </DetailRow>
                <DetailRow label={t.colKey}>{detail.key_name || '—'}</DetailRow>
                <DetailRow label={t.colGroup}>{detail.group_name || '—'}</DetailRow>
                <DetailRow label={t.colStatus}>
                  {detail.status_code}
                  {detail.upstream_status_code != null ? ` → ${detail.upstream_status_code}` : ''}
                </DetailRow>
                <DetailRow label={t.colCategory}>{categoryLabel(detail.category)}</DetailRow>
                <DetailRow label={t.colEndpoint}>{detail.inbound_endpoint || '—'}</DetailRow>
                <DetailRow label={t.colMessage}>
                  <span className="break-words whitespace-pre-wrap">{detail.message || '—'}</span>
                </DetailRow>
                {detail.error_body ? (
                  <div>
                    <dt className="text-xs text-[var(--bx-text-dim)]">{t.colMessage}</dt>
                    <dd className="mt-1 max-h-48 overflow-auto rounded-md bg-[var(--bx-bg-muted)] p-2 font-mono text-xs whitespace-pre-wrap break-all">
                      {detail.error_body}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="bx-account-mono-label">{label}</p>
      <p className="mt-1.5 font-mono text-[19px] font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function Pagination({
  page,
  pages,
  label,
  prev,
  next,
  onPrev,
  onNext,
}: {
  page: number
  pages: number
  label: string
  prev: string
  next: string
  onPrev: () => void
  onNext: () => void
}) {
  if (pages <= 1) return null
  return (
    <div className="mt-4 flex items-center gap-2">
      <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" disabled={page <= 1} onClick={onPrev}>
        {prev}
      </button>
      <span className="text-xs text-[var(--bx-text-dim)]">{label}</span>
      <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" disabled={page >= pages} onClick={onNext}>
        {next}
      </button>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2">
      <dt className="text-xs text-[var(--bx-text-dim)]">{label}</dt>
      <dd className="text-[var(--bx-text-soft)]">{children}</dd>
    </div>
  )
}
