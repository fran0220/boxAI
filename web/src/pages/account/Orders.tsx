import { useCallback, useEffect, useMemo, useState } from 'react'
import { cancelOrder, getMyOrders, requestRefund, type PaymentOrder } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'
import { cx } from '@/lib/cx'

function canRequestRefund(order: PaymentOrder): boolean {
  return order.status === 'COMPLETED' || order.status === 'PAID'
}

function statusTone(status: string): string {
  switch (status) {
    case 'COMPLETED':
    case 'PAID':
      return 'bx-account-status bx-account-status--ok'
    case 'PENDING':
      return 'bx-account-status bx-account-status--warn'
    case 'FAILED':
    case 'CANCELLED':
    case 'EXPIRED':
      return 'bx-account-status bx-account-status--muted'
    case 'REFUNDED':
      return 'bx-account-status bx-account-status--warn'
    default:
      return 'bx-account-status bx-account-status--muted'
  }
}

function normalizeType(orderType: string): 'recharge' | 'subscription' | 'refund' | 'other' {
  const s = (orderType || '').toLowerCase()
  if (s.includes('refund')) return 'refund'
  if (s.includes('sub')) return 'subscription'
  if (s.includes('recharge') || s.includes('balance') || s.includes('top')) return 'recharge'
  return 'other'
}

function escapeCsv(value: unknown): string {
  if (value == null) return ''
  const str = String(value)
  const escaped = str.replace(/"/g, '""')
  if (/^[=+\-@\t\r]/.test(str)) return `"'${escaped}"`
  if (/[,"\n\r]/.test(str)) return `"${escaped}"`
  return str
}

export function AccountOrders() {
  const { d } = useI18n()
  const t = d.accountOrders
  usePageMeta(t.metaTitle)

  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [exporting, setExporting] = useState(false)

  // Aggregate stats from a wider fetch (best-effort)
  const [allForStats, setAllForStats] = useState<PaymentOrder[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getMyOrders(page, 15)
      setOrders(res.items || [])
      setPages(res.pages || 1)
      setTotal(res.total || (res.items || []).length)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [page, t.loadFailed])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Pull first pages for stats strip
        const first = await getMyOrders(1, 50)
        if (cancelled) return
        const items = [...(first.items || [])]
        const maxPages = Math.min(first.pages || 1, 3)
        for (let p = 2; p <= maxPages; p += 1) {
          const res = await getMyOrders(p, 50)
          items.push(...(res.items || []))
        }
        if (!cancelled) setAllForStats(items)
      } catch {
        /* stats optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const pool = allForStats.length ? allForStats : orders
    let recharge = 0
    let refund = 0
    let count = pool.length
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    let monthSpend = 0
    for (const o of pool) {
      const type = normalizeType(o.order_type)
      const amount = Number(o.pay_amount ?? o.amount ?? 0)
      const st = (o.status || '').toUpperCase()
      const paid = st === 'PAID' || st === 'COMPLETED'
      if (type === 'recharge' && paid) recharge += amount
      if (type === 'refund' || st === 'REFUNDED') refund += Number(o.refund_amount ?? amount)
      if (paid && o.created_at) {
        const d = new Date(o.created_at)
        if (d.getMonth() === month && d.getFullYear() === year) {
          if (type === 'subscription' || type === 'recharge') monthSpend += amount
        }
      }
    }
    return {
      recharge,
      monthSpend,
      count: total || count,
      refund,
    }
  }, [allForStats, orders, total])

  const filtered = useMemo(() => {
    if (!typeFilter) return orders
    return orders.filter((o) => normalizeType(o.order_type) === typeFilter)
  }, [orders, typeFilter])

  async function onCancel(order: PaymentOrder) {
    if (!window.confirm(t.confirmCancel)) return
    setSuccess('')
    try {
      await cancelOrder(order.id)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.cancelFailed)
    }
  }

  async function onRefund(order: PaymentOrder) {
    const reason = window.prompt(t.refundReason)
    if (reason === null) return
    const trimmed = reason.trim()
    if (!trimmed) return
    setError('')
    setSuccess('')
    try {
      await requestRefund(order.id, trimmed)
      setSuccess(t.refundOk)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.refundFailed)
    }
  }

  async function exportCsv() {
    if (exporting) return
    setExporting(true)
    setError('')
    try {
      const all: PaymentOrder[] = []
      let p = 1
      let totalPages = 1
      while (p <= totalPages && all.length < 500) {
        const res = await getMyOrders(p, 50)
        all.push(...(res.items || []))
        totalPages = res.pages || 1
        if (!res.items?.length) break
        p += 1
      }
      const headers = [
        t.colId,
        t.colType,
        t.colDesc,
        t.colAmount,
        t.colMethod,
        t.colStatus,
        t.colTime,
      ]
      const body = all.map((o) =>
        [
          o.out_trade_no || o.id,
          o.order_type,
          o.out_trade_no || '',
          o.pay_amount ?? o.amount,
          o.payment_type,
          o.status,
          o.created_at || '',
        ]
          .map(escapeCsv)
          .join(','),
      )
      const csv = [headers.map(escapeCsv).join(','), ...body].join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.exportFailed)
    } finally {
      setExporting(false)
    }
  }

  function typeLabel(type: ReturnType<typeof normalizeType>): string {
    if (type === 'recharge') return t.typeRecharge
    if (type === 'subscription') return t.typeSubscription
    if (type === 'refund') return t.typeRefund
    return t.typeOther
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="bx-account-page-title">{t.title}</h1>
        <div className="bx-account-toolbar">
          <select
            className="bx-account-input-sm"
            value={typeFilter}
            onChange={(e) => {
              setPage(1)
              setTypeFilter(e.target.value)
              setSuccess('')
            }}
            aria-label={t.filterType}
          >
            <option value="">{t.filterAllTypes}</option>
            <option value="recharge">{t.typeRecharge}</option>
            <option value="subscription">{t.typeSubscription}</option>
            <option value="refund">{t.typeRefund}</option>
          </select>
          <button
            type="button"
            className="bx-btn bx-btn-ghost bx-btn-sm"
            disabled={exporting}
            onClick={() => void exportCsv()}
          >
            {exporting ? t.exporting : t.exportCsv}
          </button>
        </div>
      </div>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-[var(--bx-brand-bright)]">{success}</p> : null}

      <div className="bx-account-stats-strip mt-5 grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="bx-account-mono-label">{t.statRecharge}</p>
          <p className="mt-2 font-mono text-[21px] font-semibold tabular-nums">
            ${stats.recharge.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="bx-account-mono-label">{t.statMonth}</p>
          <p className="mt-2 font-mono text-[21px] font-semibold tabular-nums">
            ${stats.monthSpend.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="bx-account-mono-label">{t.statCount}</p>
          <p className="mt-2 font-mono text-[21px] font-semibold tabular-nums">{stats.count}</p>
        </div>
        <div>
          <p className="bx-account-mono-label">{t.statRefund}</p>
          <p
            className="mt-2 font-mono text-[21px] font-semibold tabular-nums"
            style={{ color: stats.refund > 0 ? 'var(--bx-warning)' : undefined }}
          >
            ${stats.refund.toFixed(2)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bx-account-panel mt-3">
          <p className="bx-account-empty">{t.empty}</p>
        </div>
      ) : (
        <div className="bx-account-table-wrap mt-3 overflow-x-auto">
          <table className="bx-account-table min-w-[720px]">
            <thead>
              <tr>
                <th>{t.colId}</th>
                <th>{t.colType}</th>
                <th>{t.colDesc}</th>
                <th className="text-right">{t.colAmount}</th>
                <th>{t.colMethod}</th>
                <th>{t.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const type = normalizeType(o.order_type)
                const amount = Number(o.pay_amount ?? o.amount ?? 0)
                const isRecharge = type === 'recharge'
                const isRefund = type === 'refund' || o.status === 'REFUNDED'
                return (
                  <tr key={o.id}>
                    <td>
                      <span className="block font-mono text-[11.5px] text-[var(--bx-text-soft)]">
                        {o.out_trade_no || o.id}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] text-[var(--bx-text-dim)]">
                        {o.created_at ? new Date(o.created_at).toLocaleString() : '—'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={cx(
                          'bx-account-type-badge',
                          type === 'recharge' && 'bx-account-type-badge--recharge',
                          type === 'subscription' && 'bx-account-type-badge--subscription',
                          type === 'refund' && 'bx-account-type-badge--refund',
                          type === 'other' && 'bx-account-type-badge--other',
                        )}
                      >
                        {typeLabel(type)}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate text-[var(--bx-text-muted)]">
                      {o.order_type}
                      {o.plan_id ? ` · plan #${o.plan_id}` : ''}
                      {o.status === 'PENDING' || canRequestRefund(o) ? (
                        <span className="ml-2 inline-flex gap-1">
                          {o.status === 'PENDING' ? (
                            <button
                              type="button"
                              className="bx-account-outline-btn"
                              onClick={() => void onCancel(o)}
                            >
                              {t.cancel}
                            </button>
                          ) : null}
                          {canRequestRefund(o) ? (
                            <button
                              type="button"
                              className="bx-account-outline-btn"
                              onClick={() => void onRefund(o)}
                            >
                              {t.refund}
                            </button>
                          ) : null}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className="num text-right font-semibold"
                      style={{
                        color: isRecharge || isRefund ? 'var(--bx-success)' : undefined,
                      }}
                    >
                      {isRecharge || isRefund ? '+' : ''}${amount.toFixed(2)}
                    </td>
                    <td className="font-mono text-[11px] text-[var(--bx-text-muted)]">
                      {o.payment_type || '—'}
                    </td>
                    <td>
                      <span className={statusTone(o.status)}>{o.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="bx-account-foot-meta">
        {t.ordersCount.replace('{n}', String(total || orders.length))} ·{' '}
        {t.page.replace('{page}', String(page)).replace('{pages}', String(pages))}
      </p>
      {pages > 1 ? (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            className="bx-btn bx-btn-ghost bx-btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t.prev}
          </button>
          <button
            type="button"
            className="bx-btn bx-btn-ghost bx-btn-sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t.next}
          </button>
        </div>
      ) : null}
    </div>
  )
}
