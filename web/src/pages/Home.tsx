import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useInView, useReducedMotion } from 'motion/react'
import {
  ArrowRight,
  Code2,
  FolderOpen,
  Image as ImageIcon,
  LayoutDashboard,
  Monitor,
  Play,
  Sparkles,
} from 'lucide-react'
import { BRAND_NAME, consoleOrigin } from '@/lib/brand'
import { usePageMeta } from '@/lib/meta'
import { useI18n } from '@/i18n'
import { MODEL_MARQUEE } from '@/content/models'
import { Section } from '@/components/ui/Section'
import { Accordion } from '@/components/ui/Accordion'
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal'
import { AnimatedNumber } from '@/components/motion/AnimatedNumber'

function TypeText({ text, startDelay = 0 }: { text: string; startDelay?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduced = useReducedMotion()
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!inView) return
    if (reduced) {
      setCount(text.length)
      setStarted(true)
      return
    }
    const startTimer = window.setTimeout(() => setStarted(true), startDelay)
    return () => window.clearTimeout(startTimer)
  }, [inView, reduced, startDelay, text.length])

  useEffect(() => {
    if (!started || count >= text.length) return
    const timer = window.setTimeout(() => setCount((c) => c + 2), 24)
    return () => window.clearTimeout(timer)
  }, [started, count, text.length])

  const done = count >= text.length
  return (
    <span ref={ref}>
      {text.slice(0, count)}
      {started && !done ? <span className="bx-caret ml-0.5" /> : null}
    </span>
  )
}

function HeroPreview() {
  const { d } = useI18n()
  return (
    <div className="bx-card-grad mx-auto mt-14 max-w-3xl overflow-hidden text-left">
      <div className="flex items-center gap-2 border-b border-[var(--bx-border)] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-xs text-[var(--bx-text-dim)]">{BRAND_NAME} Creator</span>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <div className="ml-auto max-w-[85%] w-fit rounded-2xl rounded-br-md bg-[var(--bx-active)] px-4 py-2.5 text-sm">
          {d.home.hero.previewUser}
        </div>
        <div className="mr-auto max-w-[85%] w-fit rounded-2xl rounded-bl-md bg-[var(--bx-bg-muted)] px-4 py-2.5 text-sm leading-relaxed text-[var(--bx-text-soft)]">
          <TypeText text={d.home.hero.previewReply} startDelay={700} />
        </div>
      </div>
    </div>
  )
}

export function Home() {
  const { d } = useI18n()
  usePageMeta(d.home.metaTitle, d.home.hero.subtitle)
  const console_ = consoleOrigin()

  const featureIcons = [Sparkles, Monitor, LayoutDashboard, Code2]
  const featureLinks: Array<{ to?: string; href?: string }> = [
    { to: '/create' },
    { to: '/studio' },
    { href: `${console_}/boxai/sso/start` },
    { href: `${console_}/boxai/sso/start?return_to=${encodeURIComponent('/keys')}` },
  ]
  const showcaseIcons = { image: ImageIcon, video: Play, assets: FolderOpen }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:pb-24 sm:pt-24">
          <Reveal>
            <p className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-[var(--bx-border-strong)] px-3.5 py-1.5 text-xs font-medium text-[var(--bx-teal)]">
              <Sparkles size={13} />
              {d.home.hero.badge}
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              <span className="bx-gradient-text">{d.home.hero.title1}</span>
              <br />
              {d.home.hero.title2}
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mx-auto mt-6 max-w-2xl text-base text-[var(--bx-text-muted)] sm:text-lg">
              {d.home.hero.subtitle}
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to="/create" className="bx-btn bx-btn-primary bx-btn-lg">
                {d.home.hero.ctaPrimary}
                <ArrowRight size={17} />
              </Link>
              <Link to="/studio" className="bx-btn bx-btn-ghost bx-btn-lg">
                {d.home.hero.ctaSecondary}
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.34} y={40}>
            <HeroPreview />
          </Reveal>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-[var(--bx-border)] bg-[var(--bx-bg-muted)]">
        <Stagger className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 sm:grid-cols-4 sm:py-12">
          {d.home.stats.map((stat) => (
            <StaggerItem key={stat.label} className="text-center">
              <p className="text-3xl font-bold tracking-tight sm:text-4xl">
                <AnimatedNumber value={stat.value} className="bx-gradient-text" />
                <span className="bx-gradient-text">{stat.suffix}</span>
              </p>
              <p className="mt-1.5 text-xs text-[var(--bx-text-muted)] sm:text-sm">{stat.label}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Model marquee */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <Reveal>
          <p className="mb-7 text-center text-sm text-[var(--bx-text-dim)]">{d.home.marqueeTitle}</p>
        </Reveal>
        <div className="bx-marquee">
          <div className="bx-marquee-track">
            {[...MODEL_MARQUEE, ...MODEL_MARQUEE].map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="rounded-full border border-[var(--bx-border)] px-5 py-2 text-sm text-[var(--bx-text-muted)]"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <Section
        eyebrow={d.home.features.eyebrow}
        title={d.home.features.title}
        subtitle={d.home.features.subtitle}
      >
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {d.home.features.items.map((item, i) => {
            const Icon = featureIcons[i] ?? Sparkles
            const link = featureLinks[i] ?? {}
            const body = (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bx-active)] text-[var(--bx-teal)]">
                  <Icon size={19} />
                </div>
                <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--bx-text-muted)]">{item.body}</p>
              </>
            )
            return (
              <StaggerItem key={item.title}>
                {link.to ? (
                  <Link to={link.to} className="bx-card bx-card-hover block h-full p-6">
                    {body}
                  </Link>
                ) : (
                  <a href={link.href} className="bx-card bx-card-hover block h-full p-6">
                    {body}
                  </a>
                )}
              </StaggerItem>
            )
          })}
        </Stagger>
      </Section>

      {/* How it works */}
      <Section eyebrow={d.home.how.eyebrow} title={d.home.how.title} subtitle={d.home.how.subtitle}>
        <Stagger className="grid gap-4 sm:grid-cols-3">
          {d.home.how.steps.map((step, i) => (
            <StaggerItem key={step.title} className="bx-card relative p-6">
              <span className="bx-gradient-text text-4xl font-bold">{i + 1}</span>
              <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--bx-text-muted)]">{step.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* Showcase */}
      <Section
        eyebrow={d.home.showcase.eyebrow}
        title={d.home.showcase.title}
        subtitle={d.home.showcase.subtitle}
        className="space-y-6"
      >
        {(['image', 'video', 'assets'] as const).map((key, i) => {
          const item = d.home.showcase[key]
          const Icon = showcaseIcons[key]
          return (
            <Reveal key={key}>
              <div
                className={`bx-card grid items-center gap-8 overflow-hidden p-7 sm:p-10 lg:grid-cols-2 ${
                  i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bx-active)] text-[var(--bx-teal)]">
                    <Icon size={19} />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold sm:text-2xl">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--bx-text-muted)] sm:text-base">
                    {item.body}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {item.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-center gap-2.5 text-sm text-[var(--bx-text-soft)]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bx-teal)]" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={`/create/${key}`}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--bx-teal)] hover:underline"
                  >
                    {d.home.hero.ctaPrimary}
                    <ArrowRight size={15} />
                  </Link>
                </div>
                <ShowcaseVisual kind={key} />
              </div>
            </Reveal>
          )
        })}
      </Section>

      {/* Pricing teaser */}
      <Section>
        <Reveal>
          <div className="bx-card-grad relative overflow-hidden p-8 text-center sm:p-14">
            <h2 className="text-2xl font-bold sm:text-3xl">{d.home.pricingTeaser.title}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--bx-text-muted)] sm:text-base">
              {d.home.pricingTeaser.subtitle}
            </p>
            <Link to="/pricing" className="bx-btn bx-btn-primary bx-btn-lg mt-7 inline-flex">
              {d.home.pricingTeaser.cta}
              <ArrowRight size={17} />
            </Link>
          </div>
        </Reveal>
      </Section>

      {/* FAQ */}
      <Section title={d.home.faq.title} className="max-w-3xl">
        <Reveal>
          <Accordion items={d.home.faq.items} />
        </Reveal>
      </Section>

      {/* Final CTA */}
      <Section className="pb-24">
        <Reveal>
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              <span className="bx-gradient-text">{d.home.cta.title}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--bx-text-muted)]">{d.home.cta.subtitle}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/signup" className="bx-btn bx-btn-primary bx-btn-lg">
                {d.home.cta.primary}
              </Link>
              <Link to="/pricing" className="bx-btn bx-btn-ghost bx-btn-lg">
                {d.home.cta.secondary}
              </Link>
            </div>
          </div>
        </Reveal>
      </Section>
    </div>
  )
}

function ShowcaseVisual({ kind }: { kind: 'image' | 'video' | 'assets' }) {
  if (kind === 'assets') {
    return (
      <div className="grid grid-cols-3 gap-2.5" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="relative aspect-square rounded-xl border border-[var(--bx-border)]"
            style={{
              background: `linear-gradient(${110 + i * 30}deg, rgba(45,212,191,${0.2 - i * 0.02}), rgba(56,189,248,${0.08 + i * 0.02}))`,
            }}
          >
            {i === 1 || i === 4 ? (
              <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bx-bg-elevated)] text-[10px] text-[var(--bx-teal)]">
                ★
              </span>
            ) : null}
          </div>
        ))}
      </div>
    )
  }
  if (kind === 'image') {
    return (
      <div className="grid grid-cols-2 gap-3" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="aspect-square rounded-2xl border border-[var(--bx-border)]"
            style={{
              background: `linear-gradient(${135 + i * 40}deg, rgba(45,212,191,${0.24 - i * 0.04}), rgba(56,189,248,${0.1 + i * 0.04}))`,
            }}
          />
        ))}
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] p-5" aria-hidden>
      <div className="flex aspect-video items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(45,212,191,0.16),rgba(56,189,248,0.12))]">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bx-grad-cta)] text-[var(--bx-teal-ink)] shadow-[var(--bx-shadow-cta)]">
          <Play size={22} fill="currentColor" />
        </span>
      </div>
      <div className="mt-4 h-1.5 w-full rounded-full bg-[var(--bx-bg-muted)]">
        <div className="h-full w-2/3 rounded-full bg-[var(--bx-grad-cta)]" />
      </div>
    </div>
  )
}
