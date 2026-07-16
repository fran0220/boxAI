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
import { CubeMark } from '@/components/brand/CubeMark'
import { GradientRing } from '@/components/brand/GradientRing'

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
    <div className="bx-card-grad mx-auto max-w-3xl overflow-hidden text-left">
      <div className="flex items-center gap-2 border-b border-[var(--bx-border)] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="bx-display ml-3 text-xs tracking-tight text-[var(--bx-text-dim)]">
          {BRAND_NAME} Creator
        </span>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[var(--bx-active)] px-4 py-2.5 text-sm">
          {d.home.hero.previewUser}
        </div>
        <div className="mr-auto w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-[var(--bx-bg-muted)] px-4 py-2.5 text-sm leading-relaxed text-[var(--bx-text-soft)]">
          <TypeText text={d.home.hero.previewReply} startDelay={700} />
        </div>
      </div>
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
            className="relative aspect-square rounded-[var(--bx-radius-md)] border border-[var(--bx-border)]"
            style={{
              background: `linear-gradient(${110 + i * 30}deg, rgba(45,212,191,${0.22 - i * 0.02}), rgba(56,189,248,${0.08 + i * 0.02}))`,
            }}
          >
            {i === 1 || i === 4 ? (
              <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bx-bg-elevated)] text-[10px] text-[var(--bx-spark)]">
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
            className="aspect-square rounded-[var(--bx-radius-lg)] border border-[var(--bx-border)]"
            style={{
              background: `linear-gradient(${135 + i * 40}deg, rgba(45,212,191,${0.24 - i * 0.04}), rgba(56,189,248,${0.1 + i * 0.04}))`,
            }}
          />
        ))}
      </div>
    )
  }
  return (
    <div
      className="rounded-[var(--bx-radius-lg)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] p-5"
      aria-hidden
    >
      <div
        className="flex aspect-video items-center justify-center rounded-[var(--bx-radius-md)]"
        style={{
          background: 'linear-gradient(135deg, rgba(45,212,191,0.16), rgba(56,189,248,0.12))',
        }}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-[var(--bx-radius-md)] bg-[var(--bx-grad-cta)] text-[var(--bx-brand-ink)] shadow-[var(--bx-shadow-cta)]">
          <Play size={22} fill="currentColor" />
        </span>
      </div>
      <div className="mt-4 h-1.5 w-full rounded-full bg-[var(--bx-bg-muted)]">
        <div className="h-full w-2/3 rounded-full bg-[var(--bx-grad-cta)]" />
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
    <div className="overflow-x-hidden">
      {/* Hero — Vue dual-column + React chat preview */}
      <section className="relative">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-8 lg:pt-16">
          <div className="text-center lg:text-left">
            <Reveal>
              <p className="bx-badge mb-7">
                <Sparkles size={13} className="text-[var(--bx-spark)]" />
                {d.home.hero.badge}
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="bx-display font-bold leading-[0.98] tracking-tight">
                <span className="block text-[clamp(1.85rem,4.2vw,2.75rem)] text-[var(--bx-text)]">
                  {d.home.hero.title1}
                </span>
                <span className="bx-gradient-text mt-1 block text-[clamp(2.6rem,7.5vw,5rem)] font-extrabold tracking-tighter">
                  {d.home.hero.title2}
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.14}>
              <p className="mx-auto mt-6 max-w-[440px] text-base leading-relaxed text-[var(--bx-text-muted)] sm:text-lg lg:mx-0">
                {d.home.hero.subtitle}
              </p>
            </Reveal>
            <Reveal delay={0.22}>
              <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <Link to="/create" className="bx-btn bx-btn-primary bx-btn-lg">
                  {d.home.hero.ctaPrimary}
                  <ArrowRight size={17} />
                </Link>
                <Link to="/studio" className="bx-btn bx-btn-ghost bx-btn-lg">
                  {d.home.hero.ctaSecondary}
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.18} y={36} className="mx-auto w-full max-w-[280px] sm:max-w-none">
            <CubeMark maxWidth={440} />
          </Reveal>
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal delay={0.28} y={40}>
            <HeroPreview />
          </Reveal>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-16 border-y border-[var(--bx-border)] bg-[var(--bx-bg-muted)]/60 backdrop-blur-sm sm:mt-20">
        <Stagger className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 sm:grid-cols-4 sm:px-6 sm:py-12">
          {d.home.stats.map((stat) => (
            <StaggerItem key={stat.label} className="text-center">
              <p className="bx-display bx-num text-3xl font-bold tracking-tight sm:text-4xl">
                <AnimatedNumber value={stat.value} className="bx-gradient-text" />
                <span className="bx-gradient-text">{stat.suffix}</span>
              </p>
              <p className="mt-1.5 text-xs text-[var(--bx-text-muted)] sm:text-sm">{stat.label}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Model marquee */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <Reveal>
          <p className="bx-display mb-7 text-center text-xs font-medium tracking-[0.12em] text-[var(--bx-text-dim)]">
            {d.home.marqueeTitle}
          </p>
        </Reveal>
        <div className="bx-marquee">
          <div className="bx-marquee-track">
            {[...MODEL_MARQUEE, ...MODEL_MARQUEE].map((name, i) => (
              <span key={`${name}-${i}`} className="bx-chip">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Product matrix */}
      <Section
        id="pillars"
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
                <div className="bx-icon-box">
                  <Icon size={19} />
                </div>
                <h3 className="bx-display mt-4 text-base font-semibold tracking-tight">{item.title}</h3>
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
              <span className="bx-display bx-gradient-text text-4xl font-bold tracking-tighter">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="bx-display mt-3 text-base font-semibold tracking-tight">{step.title}</h3>
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
                  <div className="bx-icon-box">
                    <Icon size={19} />
                  </div>
                  <h3 className="bx-display mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--bx-text-muted)] sm:text-base">
                    {item.body}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {item.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-center gap-2.5 text-sm text-[var(--bx-text-soft)]"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bx-spark)] shadow-[0_0_8px_var(--bx-spark-dim)]" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={`/create/${key}`}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--bx-brand-bright)] transition-colors hover:text-[var(--bx-spark)]"
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

      {/* Pricing teaser — gradient ring CTA */}
      <Section>
        <Reveal>
          <GradientRing>
            <div className="px-6 py-12 text-center sm:px-12 sm:py-14">
              <h2 className="bx-display text-2xl font-bold tracking-tight sm:text-3xl">
                {d.home.pricingTeaser.title}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--bx-text-muted)] sm:text-base">
                {d.home.pricingTeaser.subtitle}
              </p>
              <Link to="/pricing" className="bx-btn bx-btn-primary bx-btn-lg mt-7 inline-flex">
                {d.home.pricingTeaser.cta}
                <ArrowRight size={17} />
              </Link>
            </div>
          </GradientRing>
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
            <h2 className="bx-display text-3xl font-bold tracking-tight sm:text-4xl">
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
