import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getActiveSubscriptions,
  getCheckoutInfo,
  getMyOrders,
  getMySubscriptions,
  type PaymentOrder,
  type SubscriptionPlan,
  type UserSubscription,
} from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'
import { cx } from '@/lib/cx'

function isActiveStatus(status: string): boolean {
  const s = status.toLowerCase()
  return s.includes('active') || s === 'ok' || s === 'running'
}

function planLooksYearly(plan: SubscriptionPlan): boolean {
  const unit = (plan.validity_unit || '').toLowerCase()
  if (unit.includes('year') || unit === 'y' || unit === 'yr') return true
  if (unit.includes('month') || unit === 'm' || unit === 'mo') return false
  return (plan.validity_days || 0) >= 300
}

function formatPrice(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (n === 0) return '$0'
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`
}

export function AccountSubscription() {
  const { d } = useI18n()
  const t = d.accountSubscription
  usePageMeta(t.metaTitle)

  const [subs, setSubs] = useState<UserSubscription[]>([])
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [invoices, setInvoices] = useState<PaymentOrder[]>([])
  const [yearly, setYearly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [subRes, checkout, orders] = await Promise.all([
          getActiveSubscriptions()
            .catch(() => null)
            .then((list) => list ?? getMySubscriptions().catch(() => [] as UserSubscription[])),
          getCheckoutInfo().catch(() => null),
          getMyOrders(1, 20).catch(() => null),
        ])
        if (cancelled) return
        setSubs(Array.isArray(subRes) ? subRes : [])
        setPlans(checkout?.plans || [])
        const paid = (orders?.items || []).filter((o) => {
          const s = (o.status || '').toUpperCase()
          return s === 'PAID' || s === 'COMPLETED' || s === 'REFUNDED'
        })
        setInvoices(paid.slice(0, 12))
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t.loadFailed)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t.loadFailed])

  const activeSub = useMemo(() => {
    const active = subs.find((s) => isActiveStatus(s.status))
    return active || subs[0] || null
  }, [subs])

  const activeGroupIds = useMemo(() => {
    const ids = new Set<number>()
    for (const s of subs) {
      if (isActiveStatus(s.status)) ids.add(s.group_id)
    }
    return ids
  }, [subs])

  const displayPlans = useMemo(() => {
    if (!plans.length) return []
    const yearlyPlans = plans.filter(planLooksYearly)
    const monthlyPlans = plans.filter((p) => !planLooksYearly(p))
    const pool = yearly ? (yearlyPlans.length ? yearlyPlans : plans) : monthlyPlans.length ? monthlyPlans : plans
    // Prefer distinct names; fall back to full list
    const seen = new Set<string>()
    const out: SubscriptionPlan[] = []
    for (const p of pool) {
      const key = p.name || String(p.id)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(p)
    }
    return out.slice(0, 8)
  }, [plans, yearly])

  const hasYearlyToggle = useMemo(() => {
    const y = plans.some(planLooksYearly)
    const m = plans.some((p) => !planLooksYearly(p))
    return y && m
  }, [plans])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  const currentName = activeSub?.group?.name || (activeSub ? `Group #${activeSub.group_id}` : null)
  const expiresLabel = activeSub?.expires_at
    ? new Date(activeSub.expires_at).toLocaleDateString()
    : null

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="bx-account-page-title">{t.title}</h1>
        {hasYearlyToggle ? (
          <div className="bx-account-cycle" role="group" aria-label={t.billingCycle}>
            <button
              type="button"
              className={cx('bx-account-cycle-btn', !yearly && 'is-active')}
              onClick={() => setYearly(false)}
            >
              {t.cycleMonthly}
            </button>
            <button
              type="button"
              className={cx('bx-account-cycle-btn', yearly && 'is-active')}
              onClick={() => setYearly(true)}
            >
              {t.yearlySave}
            </button>
          </div>
        ) : (
          <Link to="/checkout?type=subscription" className="bx-btn bx-btn-primary bx-btn-sm">
            {t.buy}
          </Link>
        )}
      </div>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

      {/* Current plan hero */}
      <div className="bx-account-panel-grad mt-5 flex flex-wrap items-center justify-between gap-4 !px-6 !py-5">
        <div className="min-w-0">
          <p className="bx-account-mono-label">{t.currentPlan}</p>
          {currentName ? (
            <>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-2.5">
                <span className="text-[22px] font-extrabold tracking-tight">{currentName}</span>
                {activeSub && isActiveStatus(activeSub.status) ? (
                  <span className="bx-account-pill-ok">{t.active}</span>
                ) : activeSub ? (
                  <span className="bx-account-status bx-account-status--muted">{activeSub.status}</span>
                ) : null}
              </div>
              <p className="mt-2 font-mono text-[11.5px] text-[var(--bx-text-muted)]">
                {expiresLabel
                  ? `${t.nextRenewal} ${expiresLabel}`
                  : t.noExpiry}
                {activeSub
                  ? ` · ${t.monthlyUsage} $${(activeSub.monthly_usage_usd ?? 0).toFixed(2)}`
                  : ''}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-[22px] font-extrabold tracking-tight">{t.noActivePlan}</p>
              <p className="mt-2 font-mono text-[11.5px] text-[var(--bx-text-muted)]">{t.empty}</p>
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link to="/account/orders" className="bx-btn bx-btn-ghost bx-btn-sm">
            {t.managePayment}
          </Link>
          <button
            type="button"
            className="bx-btn bx-btn-ghost bx-btn-sm text-[var(--bx-text-muted)] opacity-70"
            disabled
            title={t.cancelUnavailable}
          >
            {t.cancelSubscription}
          </button>
        </div>
      </div>

      {/* Active subscriptions usage windows */}
      {subs.length > 0 ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {subs.map((sub) => (
            <li key={sub.id} className="bx-account-panel bx-account-panel-pad">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="m-0 text-[15px] font-bold">
                    {sub.group?.name || `Group #${sub.group_id}`}
                  </p>
                  <p className="mt-1.5">
                    <span
                      className={
                        isActiveStatus(sub.status)
                          ? 'bx-account-status bx-account-status--ok'
                          : 'bx-account-status bx-account-status--muted'
                      }
                    >
                      {sub.status}
                    </span>
                  </p>
                </div>
                {sub.expires_at ? (
                  <p className="m-0 font-mono text-[11px] text-[var(--bx-text-dim)]">
                    {t.expires}: {new Date(sub.expires_at).toLocaleDateString()}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--bx-line)] pt-3">
                <div>
                  <p className="bx-account-mono-label">{t.daily}</p>
                  <p className="mt-1 font-mono text-sm tabular-nums">
                    ${(sub.daily_usage_usd ?? 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="bx-account-mono-label">{t.weekly}</p>
                  <p className="mt-1 font-mono text-sm tabular-nums">
                    ${(sub.weekly_usage_usd ?? 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="bx-account-mono-label">{t.monthly}</p>
                  <p className="mt-1 font-mono text-sm tabular-nums">
                    ${(sub.monthly_usage_usd ?? 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Plan cards */}
      {displayPlans.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {displayPlans.map((plan) => {
            const isCurrent = activeGroupIds.has(plan.group_id)
            const features = Array.isArray(plan.features) ? plan.features.filter(Boolean) : []
            const period = yearly ? t.perMonthBilledYearly : t.perMonth
            return (
              <div
                key={plan.id}
                className={
                  isCurrent
                    ? 'bx-account-panel-grad !p-[18px_20px]'
                    : 'bx-account-panel bx-account-panel-pad'
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="m-0 text-[15px] font-extrabold">{plan.name}</p>
                  {isCurrent ? <span className="bx-account-pill-brand">{t.current}</span> : null}
                </div>
                {plan.description ? (
                  <p className="mt-1 text-[11.5px] text-[var(--bx-text-dim)]">{plan.description}</p>
                ) : null}
                <div className="mt-3.5 flex items-baseline gap-1">
                  <span className="font-mono text-[28px] font-semibold tracking-tight tabular-nums">
                    {formatPrice(plan.price)}
                  </span>
                  {plan.price > 0 ? (
                    <span className="font-mono text-[11px] text-[var(--bx-text-dim)]">{period}</span>
                  ) : null}
                </div>
                {plan.original_price != null && plan.original_price > plan.price ? (
                  <p className="mt-1 font-mono text-[11px] text-[var(--bx-text-dim)] line-through">
                    {formatPrice(plan.original_price)}
                  </p>
                ) : null}
                {features.length > 0 ? (
                  <ul className="mt-4 m-0 flex list-none flex-col gap-2 p-0">
                    {features.slice(0, 6).map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-1.5 text-xs text-[var(--bx-text-soft)]"
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--bx-brand)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mt-px shrink-0"
                          aria-hidden
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {isCurrent ? (
                  <button type="button" className="bx-account-plan-cta bx-account-plan-cta--current" disabled>
                    {t.currentPlanCta}
                  </button>
                ) : (
                  <Link
                    to={`/checkout?type=subscription&plan_id=${plan.id}`}
                    className="bx-account-plan-cta bx-account-plan-cta--primary inline-block no-underline"
                  >
                    {t.upgrade}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Invoices / payment history chrome */}
      <div className="bx-account-table-wrap mt-3">
        <div className="flex items-center justify-between px-5 pb-2.5 pt-3.5">
          <p className="m-0 text-[13.5px] font-bold">{t.invoices}</p>
          <Link
            to="/account/orders"
            className="font-mono text-[11px] font-semibold text-[var(--bx-brand-bright)] hover:text-[var(--bx-cyan,var(--bx-brand))]"
          >
            {t.viewAllOrders}
          </Link>
        </div>
        {invoices.length === 0 ? (
          <p className="bx-account-empty">{t.noInvoices}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="bx-account-table min-w-[560px]">
              <thead>
                <tr>
                  <th>{t.colDate}</th>
                  <th>{t.colDesc}</th>
                  <th className="text-right">{t.colAmount}</th>
                  <th>{t.colStatus}</th>
                  <th className="text-right">{t.colInvoice}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((iv) => {
                  const paid =
                    iv.status === 'PAID' ||
                    iv.status === 'COMPLETED' ||
                    iv.status === 'REFUNDED'
                  return (
                    <tr key={iv.id}>
                      <td className="num font-mono text-[11.5px] text-[var(--bx-text-muted)]">
                        {iv.created_at ? new Date(iv.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="text-[var(--bx-text-soft)]">
                        {iv.order_type || '—'}
                        {iv.out_trade_no ? (
                          <span className="ml-1 font-mono text-[10px] text-[var(--bx-text-dim)]">
                            {iv.out_trade_no}
                          </span>
                        ) : null}
                      </td>
                      <td className="num text-right">
                        ${Number(iv.pay_amount ?? iv.amount ?? 0).toFixed(2)}
                      </td>
                      <td>
                        {paid ? (
                          <span className="bx-account-status bx-account-status--ok">{t.paid}</span>
                        ) : (
                          <span className="bx-account-status bx-account-status--muted">{iv.status}</span>
                        )}
                      </td>
                      <td className="text-right text-[var(--bx-text-dim)]">—</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
