import { useEffect, useState } from 'react'
import {
  Apple,
  AppWindow,
  Cpu,
  Download as DownloadIcon,
  Globe,
  KeyRound,
  Monitor,
  Puzzle,
  Terminal,
} from 'lucide-react'
import { usePageMeta } from '@/lib/meta'
import { useI18n } from '@/i18n'
import {
  detectPlatform,
  fetchDesktopRelease,
  RELEASES_PAGE_URL,
  type DesktopRelease,
  type PlatformName,
} from '@/lib/releases'
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal'
import { CtaBand, FaqList, SectionHead } from '@/components/marketing'

const PLATFORM_ICONS: Record<PlatformName, typeof Apple> = {
  macOS: Apple,
  Windows: AppWindow,
  Linux: Terminal,
}

export function Studio() {
  const { d } = useI18n()
  usePageMeta(d.studio.metaTitle, d.studio.subtitle)

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [release, setRelease] = useState<DesktopRelease | null>(null)
  const platform = detectPlatform()

  useEffect(() => {
    let cancelled = false
    fetchDesktopRelease()
      .then((r) => {
        if (cancelled) return
        setRelease(r)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) {
          setRelease(null)
          setStatus('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const recommendedSection = release?.sections.find((s) => s.title === platform)
  const primaryDownload = recommendedSection?.items[0]
  const featureIcons = [Cpu, Puzzle, KeyRound, Globe]

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-6 pb-14 pt-16 sm:pt-24">
        <Reveal>
          <p className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
            <span className="h-px w-5 bg-[var(--bx-brand)]" />
            <Monitor size={12} />
            {d.studio.badge}
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="mt-3.5 max-w-3xl text-[36px] font-extrabold leading-[1.12] tracking-tight sm:text-[52px]">
            {d.studio.title1}
            <br />
            <span className="bg-[var(--bx-grad-hero)] bg-clip-text text-transparent">
              {d.studio.title2}
            </span>
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--bx-text-muted)] sm:text-base">
            {d.studio.subtitle}
          </p>
        </Reveal>
        <Reveal delay={0.24}>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => scrollTo('download')}
              className="bx-btn bx-btn-primary bx-btn-lg"
            >
              <DownloadIcon size={17} />
              {d.studio.ctaDownload}
            </button>
            <button
              type="button"
              onClick={() => scrollTo('browser')}
              className="bx-btn bx-btn-ghost bx-btn-lg"
            >
              <Globe size={16} />
              {d.studio.ctaBrowser}
              <span className="rounded-[var(--bx-radius-sm)] bg-[var(--bx-active)] px-2 py-0.5 text-[10px] font-medium text-[var(--bx-brand-bright)]">
                {d.common.comingSoon}
              </span>
            </button>
          </div>
          {status === 'ready' && release ? (
            <p className="mt-4 font-mono text-[11px] text-[var(--bx-text-dim)]">
              {d.studio.download.version}: {release.version}
            </p>
          ) : null}
        </Reveal>

        {/* Decorative terminal (no metrics / keys) */}
        <Reveal delay={0.34} y={40}>
          <div
            className="mt-14 max-w-2xl overflow-hidden rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] text-left shadow-[var(--bx-shadow-card)]"
            aria-hidden
          >
            <div className="flex items-center gap-2 border-b border-[var(--bx-border)] px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--bx-text-dim)]" />
              <span className="font-mono text-[11px] tracking-tight text-[var(--bx-text-dim)]">
                BoxAI Studio
              </span>
            </div>
            <div className="bg-[var(--bx-bg-deep)] p-5 font-mono text-[12px] leading-relaxed">
              <span className="text-[var(--bx-text-dim)]">$</span>{' '}
              <span className="text-[var(--bx-text-soft)]">boxai agent run</span>
              <br />
              <span className="text-[var(--bx-success)]">✓</span>{' '}
              <span className="text-[var(--bx-text-muted)]">signed in · gateway ready</span>
              <br />
              <span className="text-[var(--bx-brand)]">→</span>{' '}
              <span className="text-[var(--bx-text-muted)]">skills · mcp · memory</span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1200px] px-6 pb-[72px]">
        <SectionHead
          eyebrow={d.studio.features.eyebrow}
          title={d.studio.features.title}
          subtitle={d.studio.features.subtitle}
          className="mb-10"
        />
        <Stagger className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {d.studio.features.items.map((item, i) => {
            const Icon = featureIcons[i] ?? Monitor
            return (
              <StaggerItem
                key={item.title}
                className="h-full rounded-[var(--bx-radius-lg)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] p-6 transition hover:-translate-y-0.5 hover:border-[var(--bx-brand-ring)]"
              >
                <div className="bx-icon-box">
                  <Icon size={19} />
                </div>
                <h3 className="mt-4 text-[15px] font-bold tracking-tight">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--bx-text-muted)]">
                  {item.body}
                </p>
              </StaggerItem>
            )
          })}
        </Stagger>
      </section>

      {/* Browser (WebUI) */}
      <div id="browser" className="scroll-mt-16">
        <section className="mx-auto max-w-[1200px] px-6 pb-[72px]">
          <SectionHead
            eyebrow={d.studio.browser.eyebrow}
            title={d.studio.browser.title}
            className="mb-8"
          />
          <Reveal>
            <div
              className="grid items-center gap-8 rounded-[var(--bx-radius-xl)] p-7 sm:p-10 lg:grid-cols-2"
              style={{
                background:
                  'linear-gradient(var(--bx-bg-elevated), var(--bx-bg-elevated)) padding-box, var(--bx-grad-border) border-box',
                border: '1px solid transparent',
              }}
            >
              <div>
                <p className="text-[14px] leading-relaxed text-[var(--bx-text-muted)]">
                  {d.studio.browser.body}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {d.studio.browser.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-[13.5px]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bx-spark)] shadow-[0_0_8px_var(--bx-spark-dim)]" />
                      {point}
                    </li>
                  ))}
                </ul>
                <p className="mt-5 inline-flex items-center gap-2 rounded-[var(--bx-radius-md)] border border-[var(--bx-border-strong)] px-3.5 py-2 text-xs text-[var(--bx-text-dim)]">
                  <Globe size={13} className="text-[var(--bx-brand-bright)]" />
                  {d.studio.browser.status}
                </p>
              </div>
              <div
                className="overflow-hidden rounded-[var(--bx-radius-lg)] border border-[var(--bx-border)] bg-[var(--bx-bg-deep)]"
                aria-hidden
              >
                <div className="flex items-center gap-2 border-b border-[var(--bx-border)] px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--bx-bg-muted)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--bx-bg-muted)]" />
                  <div className="ml-2 flex-1 rounded-[var(--bx-radius-sm)] bg-[var(--bx-bg-muted)] px-3 py-1 font-mono text-[10px] text-[var(--bx-text-dim)]">
                    studio.you-box.com
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--bx-text-dim)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--bx-success)]" />
                    Desktop agent online
                  </div>
                  <div className="h-2.5 w-4/5 rounded-full bg-[var(--bx-bg-muted)]" />
                  <div className="h-2.5 w-3/5 rounded-full bg-[var(--bx-bg-muted)]" />
                  <div className="ml-auto h-8 w-2/3 rounded-[var(--bx-radius-md)] bg-[var(--bx-active)]" />
                  <div className="h-2.5 w-1/2 rounded-full bg-[var(--bx-bg-muted)]" />
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </div>

      {/* Download */}
      <div id="download" className="scroll-mt-16">
        <section className="mx-auto max-w-[1200px] px-6 pb-[72px]">
          <SectionHead
            title={d.studio.download.title}
            subtitle={d.studio.download.subtitle}
            className="mb-8"
          />

          {status === 'loading' ? (
            <div className="rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] p-8 text-center text-sm text-[var(--bx-text-muted)]">
              {d.studio.download.lookingUp}
            </div>
          ) : null}

          {status === 'ready' && release ? (
            <div className="space-y-4">
              {primaryDownload ? (
                <Reveal>
                  <div
                    className="rounded-[var(--bx-radius-xl)] p-[1.5px]"
                    style={{
                      background: 'var(--bx-grad-border)',
                      backgroundSize: '300% auto',
                      animation: 'bx-borderflow 8s linear infinite',
                    }}
                  >
                    <div className="relative overflow-hidden rounded-[15px] bg-[var(--bx-bg-deep)]">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background:
                            'radial-gradient(70% 130% at 50% 0%, var(--bx-brand-soft), transparent 70%)',
                        }}
                      />
                      <div className="relative flex flex-col items-center gap-4 px-8 py-10 text-center">
                        <p className="m-0 font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--bx-brand)] uppercase">
                          {d.studio.download.recommended}
                        </p>
                        <a
                          href={primaryDownload.url}
                          className="bx-btn bx-btn-primary bx-btn-lg"
                          rel="noopener"
                        >
                          <DownloadIcon size={17} />
                          {platform} · {primaryDownload.label}
                        </a>
                        <p className="font-mono text-[11px] text-[var(--bx-text-dim)]">
                          {d.studio.download.version}: {release.version}
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ) : null}
              <Stagger className="grid gap-3.5 sm:grid-cols-3">
                {release.sections.map((section) => {
                  const Icon = PLATFORM_ICONS[section.title]
                  return (
                    <StaggerItem
                      key={section.title}
                      className="h-full rounded-[var(--bx-radius-lg)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] p-6"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={19} className="text-[var(--bx-brand-bright)]" />
                        <h3 className="text-[15px] font-bold tracking-tight">{section.title}</h3>
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        {section.items.map((item) => (
                          <a
                            key={item.url}
                            href={item.url}
                            rel="noopener"
                            className="flex items-center justify-between rounded-[var(--bx-radius-md)] border border-[var(--bx-border)] px-3.5 py-2.5 text-sm text-[var(--bx-text-soft)] transition-colors hover:border-[var(--bx-border-strong)] hover:bg-[var(--bx-hover)]"
                          >
                            {item.label}
                            <DownloadIcon size={14} className="text-[var(--bx-text-dim)]" />
                          </a>
                        ))}
                      </div>
                    </StaggerItem>
                  )
                })}
              </Stagger>
              <p className="text-center font-mono text-[11px] text-[var(--bx-text-dim)]">
                {d.studio.download.allBuilds}{' '}
                <a href={RELEASES_PAGE_URL} className="underline" target="_blank" rel="noopener">
                  GitHub Releases
                </a>
              </p>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] p-8 text-center">
              <h3 className="text-lg font-bold">{d.studio.download.lookupFailed}</h3>
              <p className="mt-2 text-sm text-[var(--bx-text-muted)]">
                {d.studio.download.lookupFailedBody}
              </p>
              <a
                className="bx-btn bx-btn-primary mt-6 inline-flex"
                href={RELEASES_PAGE_URL}
                target="_blank"
                rel="noopener"
              >
                {d.studio.download.browseGithub}
              </a>
            </div>
          ) : null}
        </section>
      </div>

      {/* Install notes */}
      <section className="mx-auto max-w-[1200px] px-6 pb-[72px]">
        <SectionHead title={d.studio.install.title} className="mb-8" />
        <Stagger className="grid gap-3.5 sm:grid-cols-3">
          {d.studio.install.items.map((item) => {
            const Icon = PLATFORM_ICONS[item.title as PlatformName] ?? Monitor
            return (
              <StaggerItem
                key={item.title}
                className="h-full rounded-[var(--bx-radius-lg)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] p-6"
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={18} className="text-[var(--bx-brand-bright)]" />
                  <h3 className="text-sm font-bold tracking-tight">{item.title}</h3>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--bx-text-muted)]">
                  {item.body}
                </p>
              </StaggerItem>
            )
          })}
        </Stagger>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[1200px] px-6 pb-[72px]">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_2.2fr]">
          <SectionHead title={d.studio.faq.title} />
          <Reveal>
            <FaqList items={d.studio.faq.items} idPrefix="studio-faq" />
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <CtaBand
          title={d.studio.ctaBandTitle}
          subtitle={d.studio.ctaBandSubtitle}
          actions={[
            {
              kind: 'button',
              onClick: () => scrollTo('download'),
              label: d.studio.ctaDownload,
              primary: true,
            },
            {
              kind: 'href',
              href: RELEASES_PAGE_URL,
              label: d.studio.download.browseGithub,
              primary: false,
              external: true,
            },
          ]}
        />
      </section>
    </div>
  )
}
