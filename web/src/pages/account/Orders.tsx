import { useCallback, useEffect, useState } from 'react'
import { cancelOrder, getMyOrders, requestRefund, type PaymentOrder } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

const ORDER_STATUS_FILTERS = [
  'PENDING',
  'PAID',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
] as const

function canRequestRefund(order: PaymentOrder): boolean {
  return order.status === 'COMPLETED' || order.status === 'PAID'
}

export function AccountOrders() {
  const { d } = useI18n()
  const t = d.accountOrders
  usePageMeta(t.metaTitle)

  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getMyOrders(page, 15, statusFilter || undefined)
      setOrders(res.items || [])
      setPages(res.pages || 1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, t.loadFailed])

  useEffect(() => {
    void load()
  }, [load])

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

  return (
    <div>
      <h2 className="bx-display text-2xl font-bold tracking-tight">{t.title}</h2>
      <p className="mt-1 text-sm text-[var(--bx-text-muted)]">{t.subtitle}</p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-[var(--bx-brand-bright)]">{success}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <select
          className="bx-input w-full max-w-[160px]"
          value={statusFilter}
          onChange={(e) => {
            setPage(1)
            setStatusFilter(e.target.value)
            setSuccess('')
          }}
          aria-label={t.filterStatus}
        >
          <option value="">{t.filterAll}</option>
          {ORDER_STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : orders.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[var(--bx-text-dim)]">{t.empty}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--bx-border)] text-xs text-[var(--bx-text-dim)]">
              <tr>
                <th className="pb-2 pr-3 font-medium">{t.colId}</th>
                <th className="pb-2 pr-3 font-medium">{t.colType}</th>
                <th className="pb-2 pr-3 font-medium">{t.colAmount}</th>
                <th className="pb-2 pr-3 font-medium">{t.colStatus}</th>
                <th className="pb-2 pr-3 font-medium">{t.colTime}</th>
                <th className="pb-2 font-medium">{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-[var(--bx-border)]/60">
                  <td className="py-2.5 pr-3 font-mono text-xs">{o.out_trade_no || o.id}</td>
                  <td className="py-2.5 pr-3">{o.order_type}</td>
                  <td className="py-2.5 pr-3 tabular-nums">${o.pay_amount?.toFixed(2) ?? o.amount}</td>
                  <td className="py-2.5 pr-3">{o.status}</td>
                  <td className="py-2.5 pr-3 text-[var(--bx-text-muted)]">
                    {o.created_at ? new Date(o.created_at).toLocaleString() : '—'}
                  </td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {o.status === 'PENDING' ? (
                        <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" onClick={() => void onCancel(o)}>
                          {t.cancel}
                        </button>
                      ) : null}
                      {canRequestRefund(o) ? (
                        <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" onClick={() => void onRefund(o)}>
                          {t.refund}
                        </button>
                      ) : null}
                      {o.status !== 'PENDING' && !canRequestRefund(o) ? '—' : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            className="bx-btn bx-btn-ghost bx-btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t.prev}
          </button>
          <span className="text-xs text-[var(--bx-text-dim)]">
            {page} / {pages}
          </span>
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
