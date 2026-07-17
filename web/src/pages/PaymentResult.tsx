import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { resolveOrderPublic, verifyOrder } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

export function PaymentResult() {
  const { d } = useI18n()
  const t = d.paymentResult
  usePageMeta(t.metaTitle)
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'paid' | 'pending' | 'error'>('loading')
  const [detail, setDetail] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const resume = params.get('resume_token')
      const outTradeNo = params.get('out_trade_no')
      try {
        if (resume) {
          const r = await resolveOrderPublic(resume)
          if (cancelled) return
          setDetail(r.out_trade_no)
          setStatus(r.paid || r.status === 'COMPLETED' || r.status === 'PAID' ? 'paid' : 'pending')
          return
        }
        if (outTradeNo) {
          try {
            const o = await verifyOrder(outTradeNo)
            if (cancelled) return
            setDetail(o.out_trade_no)
            setStatus(
              o.status === 'COMPLETED' || o.status === 'PAID' || o.status === 'RECHARGING'
                ? 'paid'
                : 'pending',
            )
          } catch {
            // public path may work without auth later
            if (!cancelled) {
              setDetail(outTradeNo)
              setStatus('pending')
            }
          }
          return
        }
        if (!cancelled) {
          setStatus('error')
          setError(t.missing)
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(err instanceof ApiError ? err.message : t.failed)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params, t.failed, t.missing])

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
      {status === 'loading' ? <Spinner /> : null}
      {status === 'paid' ? (
        <>
          <h1 className="bx-display text-2xl font-bold text-[var(--bx-brand-bright)]">{t.success}</h1>
          {detail ? <p className="mt-2 font-mono text-xs text-[var(--bx-text-dim)]">{detail}</p> : null}
        </>
      ) : null}
      {status === 'pending' ? (
        <>
          <h1 className="bx-display text-2xl font-bold">{t.pending}</h1>
          <p className="mt-2 text-sm text-[var(--bx-text-muted)]">{t.pendingBody}</p>
          {detail ? <p className="mt-2 font-mono text-xs text-[var(--bx-text-dim)]">{detail}</p> : null}
        </>
      ) : null}
      {status === 'error' ? (
        <>
          <h1 className="bx-display text-2xl font-bold">{t.error}</h1>
          <p className="bx-text-danger mt-2 text-sm">{error}</p>
        </>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/account/orders" className="bx-btn bx-btn-primary">
          {t.orders}
        </Link>
        <Link to="/account" className="bx-btn bx-btn-ghost">
          {t.account}
        </Link>
      </div>
    </div>
  )
}
