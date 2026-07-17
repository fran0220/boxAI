import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { createOrder, getCheckoutInfo, type CheckoutInfo, type CreateOrderResult } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { consoleOrigin } from '@/lib/brand'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { useAuth } from '@/lib/use-auth'
import { Spinner } from '@/components/ui/Spinner'
import { ProtectedRoute } from '@/components/ProtectedRoute'

function isWeChatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /MicroMessenger/i.test(navigator.userAgent)
}

function CheckoutInner() {
  const { d } = useI18n()
  const t = d.checkout
  usePageMeta(t.metaTitle)
  const [params] = useSearchParams()
  const planParam = params.get('plan')
  const typeParam = params.get('type') || 'balance'

  const [info, setInfo] = useState<CheckoutInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderType, setOrderType] = useState(typeParam === 'subscription' ? 'subscription' : 'balance')
  const [amount, setAmount] = useState('10')
  const [planId, setPlanId] = useState<number | null>(planParam ? Number(planParam) : null)
  const [method, setMethod] = useState('')
  const [busy, setBusy] = useState(false)
  const [qr, setQr] = useState<CreateOrderResult | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const c = await getCheckoutInfo()
        if (cancelled) return
        setInfo(c)
        const methods = Object.entries(c.methods || {}).filter(([, m]) => m.available)
        if (methods.length) setMethod(methods[0][0])
        if (planParam && c.plans?.some((p) => p.id === Number(planParam))) {
          setOrderType('subscription')
          setPlanId(Number(planParam))
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t.loadFailed)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [planParam, t.loadFailed])

  const methods = useMemo(
    () => Object.entries(info?.methods || {}).filter(([, m]) => m.available),
    [info],
  )

  async function onPay(e: React.FormEvent) {
    e.preventDefault()
    if (!method) return

    // WeChat in-WeChat MP stays on console for v1 (external callback domain).
    if (isWeChatBrowser() && (method === 'wxpay' || method.includes('wechat'))) {
      window.location.href = `${consoleOrigin()}/boxai/sso/start?return_to=${encodeURIComponent('/purchase')}`
      return
    }

    setBusy(true)
    setError('')
    setQr(null)
    try {
      const returnUrl = `${window.location.origin}/payment/result`
      const numAmount =
        orderType === 'subscription' && planId
          ? info?.plans.find((p) => p.id === planId)?.price ?? Number(amount)
          : Number(amount)

      const result = await createOrder({
        amount: numAmount,
        payment_type: method,
        order_type: orderType,
        plan_id: orderType === 'subscription' && planId ? planId : undefined,
        return_url: returnUrl,
        is_mobile: /Mobi|Android/i.test(navigator.userAgent),
      })

      if (result.oauth?.authorize_url) {
        window.location.href = `${consoleOrigin()}/boxai/sso/start?return_to=${encodeURIComponent('/purchase')}`
        return
      }

      if (result.pay_url) {
        window.location.href = result.pay_url
        return
      }

      if (result.qr_code) {
        setQr(result)
        return
      }

      if (result.client_secret) {
        // Stripe/Airwallex hosted Elements still on console for complex SDK flows;
        // if only client_secret without pay_url, fall back temporarily.
        const resume = result.resume_token
          ? `/payment/result?resume_token=${encodeURIComponent(result.resume_token)}`
          : '/payment/result'
        window.location.href = `${consoleOrigin()}/boxai/sso/start?return_to=${encodeURIComponent(
          method === 'airwallex' ? '/payment/airwallex' : '/payment/stripe',
        )}&fallback=${encodeURIComponent(resume)}`
        return
      }

      if (result.resume_token) {
        window.location.href = `/payment/result?resume_token=${encodeURIComponent(result.resume_token)}`
        return
      }

      setError(t.noPayUrl)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.payFailed)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <h1 className="bx-display text-3xl font-bold tracking-tight">{t.title}</h1>
      <p className="mt-2 text-sm text-[var(--bx-text-muted)]">{t.subtitle}</p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

      <form onSubmit={onPay} className="bx-card mt-8 space-y-4 p-6">
        <div className="flex gap-2">
          <button
            type="button"
            className={`bx-btn bx-btn-sm ${orderType === 'balance' ? 'bx-btn-primary' : 'bx-btn-ghost'}`}
            onClick={() => setOrderType('balance')}
            disabled={info?.balance_disabled}
          >
            {t.balance}
          </button>
          <button
            type="button"
            className={`bx-btn bx-btn-sm ${orderType === 'subscription' ? 'bx-btn-primary' : 'bx-btn-ghost'}`}
            onClick={() => setOrderType('subscription')}
          >
            {t.subscription}
          </button>
        </div>

        {orderType === 'balance' ? (
          <label className="block text-sm">
            <span className="text-[var(--bx-text-muted)]">{t.amount}</span>
            <input
              type="number"
              min={info?.global_min || 1}
              max={info?.global_max || undefined}
              step="0.01"
              className="bx-input mt-1 w-full"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
        ) : (
          <label className="block text-sm">
            <span className="text-[var(--bx-text-muted)]">{t.plan}</span>
            <select
              className="bx-input mt-1 w-full"
              value={planId ?? ''}
              onChange={(e) => setPlanId(e.target.value ? Number(e.target.value) : null)}
              required
            >
              <option value="">{t.selectPlan}</option>
              {(info?.plans || [])
                .filter((p) => p.for_sale)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ${p.price}
                  </option>
                ))}
            </select>
          </label>
        )}

        <label className="block text-sm">
          <span className="text-[var(--bx-text-muted)]">{t.method}</span>
          <select className="bx-input mt-1 w-full" value={method} onChange={(e) => setMethod(e.target.value)} required>
            {methods.map(([key, m]) => (
              <option key={key} value={key}>
                {m.display_name || key}
              </option>
            ))}
          </select>
        </label>

        {info?.help_text ? <p className="text-xs text-[var(--bx-text-dim)]">{info.help_text}</p> : null}

        <button type="submit" className="bx-btn bx-btn-primary w-full" disabled={busy || !method}>
          {busy ? d.common.loading : t.pay}
        </button>
      </form>

      {qr?.qr_code ? (
        <div className="bx-card mt-6 p-6 text-center">
          <p className="text-sm font-medium">{t.scanQr}</p>
          <img src={qr.qr_code} alt="QR" className="mx-auto mt-4 h-48 w-48 rounded bg-white p-2" />
          <p className="mt-3 text-xs text-[var(--bx-text-dim)]">{t.scanHint}</p>
          {qr.resume_token ? (
            <Link
              to={`/payment/result?resume_token=${encodeURIComponent(qr.resume_token)}`}
              className="bx-btn bx-btn-ghost bx-btn-sm mt-4"
            >
              {t.checkStatus}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function Checkout() {
  const { status } = useAuth()
  if (status === 'bootstrapping') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }
  return (
    <ProtectedRoute>
      <CheckoutInner />
    </ProtectedRoute>
  )
}
