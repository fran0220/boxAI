import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { usePageMeta } from '@/lib/meta'
import { useAuth } from '@/lib/use-auth'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal'
import { FaqList } from '@/components/marketing'

type PlanCta =
  | { kind: 'link'; to: string }
  | { kind: 'href'; href: string }

export function Pricing() {
  const { d } = useI18n()
  usePageMeta(d.pricing.metaTitle, d.pricing.subtitle)
  const { authed } = useAuth()
  const [yearly, setYearly] = useState(false)

  function planCta(ctaKind: 'signup' | 'subscribe' | 'contact'): PlanCta {
    if (ctaKind === 'contact') {
      return { kind: 'href', href: d.pricing.contactHref }
    }
    if (ctaKind === 'signup') {
      return {
        kind: 'link',
        to: authed ? '/app/create/image' : '/signup?return_to=/app/create/image',
      }
    }
    const checkout = '/checkout?type=subscription'
    return {
      kind: 'link',
      to: authed ? checkout : `/login?return_to=${encodeURIComponent(checkout)}`,
    }
  }

  const checkoutTo = authed
    ? '/checkout?type=subscription'
    : `/login?return_to=${encodeURIComponent('/checkout?type=subscription')}`

  const tabBase =
    'inline-flex items-center gap-1.5 rounded-md border-0 bg-transparent px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--bx-text-dim)] transition-colors cursor-pointer font-[inherit]'
  const tabActive =
    'inline-flex items-center gap-1.5 rounded-md border-0 bg-[var(--bx-active)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--bx-brand-bright)] transition-colors cursor-pointer font-[inherit]'

  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-24 pt-16 sm:pb-[96px] sm:pt-16">
      {/* Hero — design: flex end, monthly/yearly toggle */}
      <header className="mb-10 flex flex-col items-start justify-between gap-8 sm:mb-10 sm:flex-row sm:items-end">
        <Reveal>
          <div>
            <p className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
              <span className="h-px w-5 bg-[var(--bx-brand)]" />
              {d.pricing.badge}
            </p>
            <h1 className="mt-4 text-[36px] font-extrabold tracking-[-0.035em] sm:text-[44px]">
              {d.pricing.title}
            </h1>
            <p className="mt-3.5 max-w-[560px] text-[15px] leading-[1.7] text-[var(--bx-text-muted)]">
              {d.pricing.subtitle}
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div
            className="inline-flex shrink-0 gap-0.5 rounded-lg border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] p-[3px]"
            role="group"
            aria-label={d.pricing.billing.aria}
          >
            <button
              type="button"
              className={yearly ? tabBase : tabActive}
              aria-pressed={!yearly}
              onClick={() => setYearly(false)}
            >
              {d.pricing.billing.monthly}
            </button>
            <button
              type="button"
              className={yearly ? tabActive : tabBase}
              aria-pressed={yearly}
              onClick={() => setYearly(true)}
            >
              {d.pricing.billing.yearly}{' '}
              <span className="font-mono text-[10px] text-[var(--bx-success)]">
                {d.pricing.billing.yearlySave}
              </span>
            </button>
          </div>
        </Reveal>
      </header>

      {/* Plans — design: 4-col cards, brand check boxes, highlighted gradient border */}
      <section data-screen-label="套餐">
        <Stagger className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {d.pricing.plans.map((plan) => {
            const cta = planCta(plan.ctaKind)
            const price =
              yearly && plan.priceYearly ? plan.priceYearly : plan.price
            const desc =
              yearly && plan.descYearly ? plan.descYearly : plan.desc
            return (
              <StaggerItem key={plan.name} className="h-full">
                <div
                  className={cx(
                    'relative flex h-full flex-col rounded-[var(--bx-radius-xl)] p-6 shadow-[var(--bx-shadow-card)] transition-[border-color,transform] duration-[var(--bx-dur)] ease-[var(--bx-ease)]',
                    plan.highlighted
                      ? ''
                      : 'border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] hover:border-[var(--bx-brand-ring)] hover:-translate-y-0.5',
                  )}
                  style={
                    plan.highlighted
                      ? {
                          background:
                            'linear-gradient(var(--bx-bg-elevated), var(--bx-bg-elevated)) padding-box, var(--bx-grad-border) border-box',
                          border: '1px solid transparent',
                        }
                      : undefined
                  }
                >
                  {plan.highlighted ? (
                    <span className="absolute -top-[9px] right-4 rounded bg-[var(--bx-grad-cta)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--bx-ink)]">
                      {d.pricing.highlight}
                    </span>
                  ) : null}
                  <span
                    className={cx(
                      'font-mono text-[11px] tracking-[0.12em] uppercase',
                      plan.highlighted
                        ? 'text-[var(--bx-brand)]'
                        : 'text-[var(--bx-text-dim)]',
                    )}
                  >
                    {plan.name}
                  </span>
                  <p className="mt-3 font-mono text-[32px] font-semibold tracking-[-0.02em]">
                    {price}
                    {plan.period ? (
                      <span className="text-[13px] text-[var(--bx-text-dim)]">
                        {plan.period}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1.5 text-[12.5px] text-[var(--bx-text-dim)]">{desc}</p>
                  <ul className="mt-[18px] flex flex-1 flex-col gap-2.5 border-t border-[var(--bx-line)] pt-[18px]">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-[9px] text-[13px] leading-normal text-[var(--bx-text-soft)]"
                      >
                        <span className="mt-px flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded bg-[var(--bx-brand-soft)] text-[var(--bx-brand)]">
                          <Check size={10} strokeWidth={3} />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    {cta.kind === 'link' ? (
                      <Link
                        to={cta.to}
                        className={cx(
                          'bx-btn w-full',
                          plan.highlighted ? 'bx-btn-primary' : 'bx-btn-ghost',
                        )}
                      >
                        {plan.cta}
                      </Link>
                    ) : (
                      <a
                        href={cta.href}
                        className={cx(
                          'bx-btn w-full',
                          plan.highlighted ? 'bx-btn-primary' : 'bx-btn-ghost',
                        )}
                      >
                        {plan.cta}
                      </a>
                    )}
                  </div>
                </div>
              </StaggerItem>
            )
          })}
        </Stagger>
        <p className="mt-[18px] font-mono text-xs text-[var(--bx-text-dim)]">
          {d.pricing.note}
        </p>
      </section>

      {/* Compare — design: table with pro column soft highlight */}
      <section data-screen-label="方案对比" className="mt-20">
        <h2 className="mb-6 text-[26px] font-extrabold tracking-[-0.03em]">
          {d.pricing.compare.title}
        </h2>
        <Reveal>
          <div className="overflow-x-auto rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] shadow-[var(--bx-shadow-card)]">
            <div className="min-w-[560px]">
              <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] border-b border-[var(--bx-border)] px-5 py-3 font-mono text-[10.5px] font-semibold tracking-[0.12em] text-[var(--bx-text-dim)] uppercase">
                <span />
                {d.pricing.compare.plans.map((name, i) => (
                  <span
                    key={name}
                    className={cx(
                      'text-center',
                      i === 1 && 'text-[var(--bx-brand)]',
                    )}
                  >
                    {name}
                  </span>
                ))}
              </div>
              {d.pricing.compare.rows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] items-center border-t border-[var(--bx-line)] px-5 py-3 text-[13px] transition-colors hover:bg-[var(--bx-hover)]"
                >
                  <span className="text-[var(--bx-text-soft)]">{row.label}</span>
                  {row.values.map((value, i) => (
                    <span
                      key={i}
                      className={cx(
                        'text-center text-[var(--bx-text-muted)]',
                        i === 1 &&
                          'mx-2 -my-1 rounded-md bg-[var(--bx-brand-soft)] py-1 text-[var(--bx-text-soft)]',
                      )}
                    >
                      {value}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* FAQ + checkout CTA — design: 0.8fr / 2.2fr, CTA under title */}
      <section data-screen-label="定价FAQ" className="mt-20">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_2.2fr]">
          <div>
            <p className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
              <span className="h-px w-5 bg-[var(--bx-brand)]" />
              {d.pricing.faq.eyebrow}
            </p>
            <h2 className="mt-3.5 text-[30px] font-extrabold tracking-[-0.03em]">
              {d.pricing.faq.title}
            </h2>
            <Link
              to={checkoutTo}
              className="bx-btn bx-btn-primary mt-5 inline-flex"
            >
              {d.pricing.consoleCta}
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>
          <Reveal>
            <FaqList items={d.pricing.faq.items} idPrefix="pricing-faq" />
          </Reveal>
        </div>
      </section>
    </div>
  )
}
