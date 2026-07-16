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
import { Section } from '@/components/ui/Section'
import { Accordion } from '@/components/ui/Accordion'
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal'
import { GradientRing } from '@/components/brand/GradientRing'

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
        if (!cancelled) setStatus('error')
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
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-16 text-center sm:px-6 sm:pt-24">
        <Reveal>
          <p className="bx-badge mb-6">
            <Monitor size={13} className="text-[var(--bx-spark)]" />
            {d.studio.badge}
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="bx-display text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            {d.studio.title1}
            <br />
            <span className="bx-gradient-text">{d.studio.title2}</span>
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mx-auto mt-6 max-w-2xl text-base text-[var(--bx-text-muted)] sm:text-lg">
            {d.studio.subtitle}
          </p>
        </Reveal>
        <Reveal delay={0.24}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
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
          {release ? (
            <p className="mt-4 text-xs text-[var(--bx-text-dim)]">
              {d.studio.download.version}: {release.version}
            </p>
          ) : null}
        </Reveal>
        {/* App frame mock */}
        <Reveal delay={0.34} y={40}>
          <div className="bx-card-grad mx-auto mt-14 max-w-3xl overflow-hidden text-left" aria-hidden>
            <div className="flex items-center gap-2 border-b border-[var(--bx-border)] px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="bx-display ml-3 text-xs tracking-tight text-[var(--bx-text-dim)]">
                BoxAI Studio
              </span>
            </div>
            <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[150px_1fr]">
              <div className="space-y-2 border-r border-[var(--bx-border)] p-4">
                {[3, 4, 3, 4].map((w, i) => (
                  <div
                    key={i}
                    className="h-2.5 rounded-full bg-[var(--bx-bg-muted)]"
                    style={{ width: `${w * 22}%` }}
                  />
                ))}
              </div>
              <div className="space-y-3 p-4 sm:p-6">
                <div className="h-3 w-2/5 rounded-full bg-[var(--bx-active)]" />
                <div className="h-2.5 w-4/5 rounded-full bg-[var(--bx-bg-muted)]" />
                <div className="h-2.5 w-3/5 rounded-full bg-[var(--bx-bg-muted)]" />
                <div className="mt-4 rounded-[var(--bx-radius-md)] border border-[var(--bx-border)] bg-[var(--bx-bg-deep)] p-3 font-mono text-[10px] leading-relaxed text-[var(--bx-brand-bright)] sm:text-xs">
                  $ boxai agent run
                  <br />
                  <span className="text-[var(--bx-text-dim)]">✓ signed in · gateway ready</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Features */}
      <Section
        eyebrow={d.studio.features.eyebrow}
        title={d.studio.features.title}
        subtitle={d.studio.features.subtitle}
      >
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {d.studio.features.items.map((item, i) => {
            const Icon = featureIcons[i] ?? Monitor
            return (
              <StaggerItem key={item.title} className="bx-card bx-card-hover h-full p-6">
                <div className="bx-icon-box">
                  <Icon size={19} />
                </div>
                <h3 className="bx-display mt-4 text-base font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--bx-text-muted)]">{item.body}</p>
              </StaggerItem>
            )
          })}
        </Stagger>
      </Section>

      {/* Browser (WebUI) */}
      <div id="browser" className="scroll-mt-16">
        <Section eyebrow={d.studio.browser.eyebrow} title={d.studio.browser.title}>
          <Reveal>
            <div className="bx-card-grad grid items-center gap-8 p-7 sm:p-10 lg:grid-cols-2">
              <div>
                <p className="text-sm leading-relaxed text-[var(--bx-text-muted)]">
                  {d.studio.browser.body}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {d.studio.browser.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm">
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
              <div className="bx-card overflow-hidden" aria-hidden>
                <div className="flex items-center gap-2 border-b border-[var(--bx-border)] px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--bx-bg-muted)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--bx-bg-muted)]" />
                  <div className="ml-2 flex-1 rounded-[var(--bx-radius-sm)] bg-[var(--bx-bg-muted)] px-3 py-1 text-[10px] text-[var(--bx-text-dim)]">
                    studio.you-box.com
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  <div className="flex items-center gap-2 text-[11px] text-[var(--bx-text-dim)]">
                    <span className="h-2 w-2 rounded-full bg-[#28c840]" />
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
        </Section>
      </div>

      {/* Download */}
      <div id="download" className="scroll-mt-16">
        <Section title={d.studio.download.title} subtitle={d.studio.download.subtitle}>
          {status === 'loading' && (
            <div className="bx-card p-8 text-center text-sm text-[var(--bx-text-muted)]">
              {d.studio.download.lookingUp}
            </div>
          )}

          {status === 'ready' && release && (
            <div className="space-y-4">
              {primaryDownload ? (
                <Reveal>
                  <GradientRing>
                    <div className="flex flex-col items-center gap-4 px-8 py-10 text-center">
                      <p className="bx-eyebrow">{d.studio.download.recommended}</p>
                      <a
                        href={primaryDownload.url}
                        className="bx-btn bx-btn-primary bx-btn-lg"
                        rel="noopener"
                      >
                        <DownloadIcon size={17} />
                        {platform} · {primaryDownload.label}
                      </a>
                      <p className="text-xs text-[var(--bx-text-dim)]">
                        {d.studio.download.version}: {release.version}
                      </p>
                    </div>
                  </GradientRing>
                </Reveal>
              ) : null}
              <Stagger className="grid gap-4 sm:grid-cols-3">
                {release.sections.map((section) => {
                  const Icon = PLATFORM_ICONS[section.title]
                  return (
                    <StaggerItem key={section.title} className="bx-card h-full p-6">
                      <div className="flex items-center gap-2.5">
                        <Icon size={19} className="text-[var(--bx-brand-bright)]" />
                        <h3 className="bx-display text-base font-semibold tracking-tight">
                          {section.title}
                        </h3>
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
              <p className="text-center text-xs text-[var(--bx-text-dim)]">
                {d.studio.download.allBuilds}{' '}
                <a href={RELEASES_PAGE_URL} className="underline" target="_blank" rel="noopener">
                  GitHub Releases
                </a>
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="bx-card p-8 text-center">
              <h3 className="bx-display text-lg font-semibold">{d.studio.download.lookupFailed}</h3>
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
          )}
        </Section>
      </div>

      {/* Install notes */}
      <Section title={d.studio.install.title}>
        <Stagger className="grid gap-4 sm:grid-cols-3">
          {d.studio.install.items.map((item) => {
            const Icon = PLATFORM_ICONS[item.title as PlatformName] ?? Monitor
            return (
              <StaggerItem key={item.title} className="bx-card h-full p-6">
                <div className="flex items-center gap-2.5">
                  <Icon size={18} className="text-[var(--bx-brand-bright)]" />
                  <h3 className="bx-display text-sm font-semibold tracking-tight">{item.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--bx-text-muted)]">{item.body}</p>
              </StaggerItem>
            )
          })}
        </Stagger>
      </Section>

      {/* FAQ */}
      <Section title={d.studio.faq.title} className="max-w-3xl pb-24">
        <Reveal>
          <Accordion items={d.studio.faq.items} />
        </Reveal>
      </Section>
    </div>
  )
}
