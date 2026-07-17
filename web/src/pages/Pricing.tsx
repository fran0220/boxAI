import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Check } from 'lucide-react'
import { usePageMeta } from '@/lib/meta'
import { useAuth } from '@/lib/use-auth'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal'
import { CtaBand, FaqList, SectionHead } from '@/components/marketing'

type PlanCta =
  | { kind: 'link'; to: string }
  | { kind: 'href'; href: string }

export function Pricing() {
  const { d } = useI18n()
  usePageMeta(d.pricing.metaTitle, d.pricing.subtitle)
  const { authed } = useAuth()

  function planCta(ctaKind: 'signup' | 'subscribe' | 'contact'): PlanCta {
    if (ctaKind === 'contact') {
      return { kind: 'href', href: d.pricing.contactHref }
    }
    if (ctaKind === 'signup') {
      return { kind: 'link', to: authed ? '/create' : '/signup?return_to=/create' }
    }
    // Encode nested query so return_to keeps ?type=subscription (not a sibling login param).
    const checkout = '/checkout?type=subscription'
    return {
      kind: 'link',
      to: authed ? checkout : `/login?return_to=${encodeURIComponent(checkout)}`,
    }
  }

  const checkoutTo = authed
    ? '/checkout?type=subscription'
    : `/login?return_to=${encodeURIComponent('/checkout?type=subscription')}`

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-6 pt-16 sm:pt-24">
        <Reveal>
          <p className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
            <span className="h-px w-5 bg-[var(--bx-brand)]" />
            {d.pricing.badge}
          </p>
          <h1 className="mt-3.5 max-w-2xl text-[36px] font-extrabold tracking-tight sm:text-[48px]">
            {d.pricing.title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--bx-text-muted)] sm:text-base">
            {d.pricing.subtitle}
          </p>
        </Reveal>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-[1200px] px-6 pt-12 pb-4 sm:pt-14">
        <Stagger className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
          {d.pricing.plans.map((plan) => {
            const cta = planCta(plan.ctaKind)
            return (
              <StaggerItem key={plan.name} className="h-full">
                <div
                  className={cx(
                    'relative flex h-full flex-col rounded-[var(--bx-radius-lg)] p-[22px] transition hover:-translate-y-0.5',
                    plan.highlighted
                      ? 'border border-transparent'
                      : 'border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] hover:border-[var(--bx-brand-ring)]',
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
                    <span className="absolute -top-2.5 right-3.5 rounded bg-[var(--bx-grad-cta)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--bx-ink)]">
                      {d.pricing.highlight}
                    </span>
                  ) : null}
                  <span
                    className={cx(
                      'font-mono text-[11px] tracking-[0.12em] uppercase',
                      plan.highlighted ? 'text-[var(--bx-brand)]' : 'text-[var(--bx-text-dim)]',
                    )}
                  >
                    {plan.name}
                  </span>
                  <p className="mt-2.5 font-mono text-[30px] font-semibold tracking-tight">
                    {plan.price}
                    {plan.period ? (
                      <span className="text-[13px] text-[var(--bx-text-dim)]">{plan.period}</span>
                    ) : null}
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--bx-text-muted)]">
                    {plan.desc}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-[13px] text-[var(--bx-text-soft)]"
                      >
                        <Check size={14} className="mt-0.5 shrink-0 text-[var(--bx-spark)]" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    {cta.kind === 'link' ? (
                      <Link
                        to={cta.to}
                        className={cx(
                          'bx-btn w-full',
                          plan.highlighted ? 'bx-btn-primary' : 'bx-btn-ghost',
                        )}
                      >
                        {plan.cta}
                        <ArrowRight size={15} />
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
                        <ArrowRight size={15} />
                      </a>
                    )}
                  </div>
                </div>
              </StaggerItem>
            )
          })}
        </Stagger>
        <Reveal>
          <p className="mt-6 text-center font-mono text-[11px] text-[var(--bx-text-dim)]">
            {d.pricing.note}
          </p>
        </Reveal>
      </section>

      {/* Compare */}
      <section className="mx-auto max-w-[1200px] px-6 py-[72px]">
        <SectionHead title={d.pricing.compare.title} className="mb-8" />
        <Reveal>
          <div className="overflow-x-auto rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] shadow-[var(--bx-shadow-card)]">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--bx-border)]">
                  <th className="px-5 py-4 text-left font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--bx-text-dim)] uppercase" />
                  {d.pricing.compare.plans.map((name, i) => (
                    <th
                      key={name}
                      className={cx(
                        'px-4 py-4 text-center text-[13px] font-bold tracking-tight',
                        i === 1 && 'text-[var(--bx-brand-bright)]',
                      )}
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.pricing.compare.rows.map((row) => (
                  <tr key={row.label} className="border-b border-[var(--bx-line)] last:border-0">
                    <td className="px-5 py-3.5 text-[13px] text-[var(--bx-text-soft)]">
                      {row.label}
                    </td>
                    {row.values.map((value, i) => (
                      <td
                        key={i}
                        className="px-4 py-3.5 text-center text-[13px] text-[var(--bx-text-muted)]"
                      >
                        {value === '✓' ? (
                          <BadgeCheck size={17} className="inline text-[var(--bx-spark)]" />
                        ) : (
                          value
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[1200px] px-6 pb-[72px]">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_2.2fr]">
          <SectionHead title={d.pricing.faq.title} />
          <Reveal>
            <FaqList items={d.pricing.faq.items} idPrefix="pricing-faq" />
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <CtaBand
          title={d.pricing.ctaBandTitle}
          subtitle={d.pricing.ctaBandSubtitle}
          actions={[
            { kind: 'link', to: checkoutTo, label: d.pricing.consoleCta, primary: true },
            {
              kind: 'link',
              to: authed ? '/create' : '/signup?return_to=/create',
              label: d.nav.signup,
              primary: false,
            },
          ]}
        />
      </section>
    </div>
  )
}
