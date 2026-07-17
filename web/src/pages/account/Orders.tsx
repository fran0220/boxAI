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
      return 'bx-account-status bx-account-status--brand'
    default:
      return 'bx-account-status bx-account-status--muted'
  }
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="bx-account-page-title">{t.title}</h1>
          <p className="bx-account-page-sub">{t.subtitle}</p>
        </div>
        <select
          className="bx-account-input-sm"
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
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-[var(--bx-brand-bright)]">{success}</p> : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : orders.length === 0 ? (
        <div className="bx-account-panel mt-5">
          <p className="bx-account-empty">{t.empty}</p>
        </div>
      ) : (
        <div className="bx-account-table-wrap mt-5 overflow-x-auto">
          <table className="bx-account-table min-w-[640px]">
            <thead>
              <tr>
                <th>{t.colId}</th>
                <th>{t.colType}</th>
                <th>{t.colAmount}</th>
                <th>{t.colStatus}</th>
                <th>{t.colTime}</th>
                <th className="text-right">{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="num font-mono text-[11.5px]">{o.out_trade_no || o.id}</td>
                  <td>{o.order_type}</td>
                  <td className="num">${o.pay_amount?.toFixed(2) ?? o.amount}</td>
                  <td>
                    <span className={statusTone(o.status)}>{o.status}</span>
                  </td>
                  <td className="text-[var(--bx-text-muted)]">
                    {o.created_at ? new Date(o.created_at).toLocaleString() : '—'}
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center justify-end gap-2">
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
                      {o.status !== 'PENDING' && !canRequestRefund(o) ? (
                        <span className="text-[var(--bx-text-dim)]">—</span>
                      ) : null}
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
          <span className="bx-account-foot-meta m-0">
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
