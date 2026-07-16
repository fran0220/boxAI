import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Check } from 'lucide-react'
import { consoleOrigin } from '@/lib/brand'
import { usePageMeta } from '@/lib/meta'
import { useAuth } from '@/lib/use-auth'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { Section } from '@/components/ui/Section'
import { Accordion } from '@/components/ui/Accordion'
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal'
import { GradientRing } from '@/components/brand/GradientRing'

export function Pricing() {
  const { d } = useI18n()
  usePageMeta(d.pricing.metaTitle, d.pricing.subtitle)
  const { authed } = useAuth()

  const purchaseUrl = `${consoleOrigin()}/boxai/sso/start?return_to=${encodeURIComponent('/purchase')}`

  function planCta(index: number): { to?: string; href?: string } {
    if (index === 0) return authed ? { to: '/create' } : { to: '/signup' }
    return { href: purchaseUrl }
  }

  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 pt-16 text-center sm:px-6 sm:pt-24">
        <Reveal>
          <p className="bx-eyebrow mb-4 justify-center">{d.pricing.badge}</p>
          <h1 className="bx-display text-4xl font-bold tracking-tight sm:text-5xl">
            {d.pricing.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-[var(--bx-text-muted)] sm:text-lg">
            {d.pricing.subtitle}
          </p>
        </Reveal>
      </section>

      <Section className="pt-12 sm:pt-14">
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {d.pricing.plans.map((plan, i) => {
            const cta = planCta(i)
            const inner = (
              <>
                {plan.cta}
                <ArrowRight size={15} />
              </>
            )
            return (
              <StaggerItem
                key={plan.name}
                className={cx(
                  'relative flex h-full flex-col p-6',
                  plan.highlighted ? 'bx-card-grad' : 'bx-card bx-card-hover',
                )}
              >
                {plan.highlighted ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[var(--bx-radius-sm)] bg-[var(--bx-grad-cta)] px-3 py-1 text-xs font-semibold text-[var(--bx-brand-ink)]">
                    {d.pricing.highlight}
                  </span>
                ) : null}
                <h2 className="bx-display text-base font-semibold tracking-tight">{plan.name}</h2>
                <p className="mt-1 text-xs text-[var(--bx-text-dim)]">{plan.desc}</p>
                <p className="mt-4">
                  <span className="bx-display bx-num text-3xl font-bold tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-sm text-[var(--bx-text-muted)]">{plan.period}</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-[var(--bx-text-soft)]"
                    >
                      <Check size={15} className="mt-0.5 shrink-0 text-[var(--bx-spark)]" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {cta.to ? (
                    <Link
                      to={cta.to}
                      className={cx(
                        'bx-btn w-full',
                        plan.highlighted ? 'bx-btn-primary' : 'bx-btn-ghost',
                      )}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <a
                      href={cta.href}
                      className={cx(
                        'bx-btn w-full',
                        plan.highlighted ? 'bx-btn-primary' : 'bx-btn-ghost',
                      )}
                    >
                      {inner}
                    </a>
                  )}
                </div>
              </StaggerItem>
            )
          })}
        </Stagger>
        <Reveal>
          <p className="mt-6 text-center text-xs text-[var(--bx-text-dim)]">{d.pricing.note}</p>
        </Reveal>
      </Section>

      <Section title={d.pricing.compare.title}>
        <Reveal>
          <div className="bx-card overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--bx-border)]">
                  <th className="px-5 py-4 text-left font-medium text-[var(--bx-text-muted)]" />
                  {d.pricing.compare.plans.map((name, i) => (
                    <th
                      key={name}
                      className={cx(
                        'bx-display px-4 py-4 text-center font-semibold tracking-tight',
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
                  <tr key={row.label} className="border-b border-[var(--bx-border)] last:border-0">
                    <td className="px-5 py-3.5 text-[var(--bx-text-soft)]">{row.label}</td>
                    {row.values.map((value, i) => (
                      <td key={i} className="px-4 py-3.5 text-center text-[var(--bx-text-muted)]">
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
      </Section>

      <Section title={d.pricing.faq.title} className="max-w-3xl pb-24">
        <Reveal>
          <Accordion items={d.pricing.faq.items} />
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10">
            <GradientRing>
              <div className="px-6 py-10 text-center">
                <a href={purchaseUrl} className="bx-btn bx-btn-primary bx-btn-lg">
                  {d.pricing.consoleCta}
                  <ArrowRight size={17} />
                </a>
              </div>
            </GradientRing>
          </div>
        </Reveal>
      </Section>
    </div>
  )
}
