import { useCallback, useEffect, useState } from 'react'
import { cancelOrder, getMyOrders, type PaymentOrder } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

export function AccountOrders() {
  const { d } = useI18n()
  const t = d.accountOrders
  usePageMeta(t.metaTitle)

  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getMyOrders(page, 15)
      setOrders(res.items || [])
      setPages(res.pages || 1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [page, t.loadFailed])

  useEffect(() => {
    void load()
  }, [load])

  async function onCancel(order: PaymentOrder) {
    if (!window.confirm(t.confirmCancel)) return
    try {
      await cancelOrder(order.id)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.cancelFailed)
    }
  }

  return (
    <div>
      <h2 className="bx-display text-2xl font-bold tracking-tight">{t.title}</h2>
      <p className="mt-1 text-sm text-[var(--bx-text-muted)]">{t.subtitle}</p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

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
                    {o.status === 'PENDING' ? (
                      <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" onClick={() => void onCancel(o)}>
                        {t.cancel}
                      </button>
                    ) : (
                      '—'
                    )}
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
