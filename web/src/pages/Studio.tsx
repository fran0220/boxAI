import { useEffect, useState } from 'react'
import {
  Apple,
  AppWindow,
  Cpu,
  Download as DownloadIcon,
  Globe,
  KeyRound,
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
import { FaqList } from '@/components/marketing'
import { cx } from '@/lib/cx'

const PLATFORM_ICONS: Record<PlatformName, typeof Apple> = {
  macOS: Apple,
  Windows: AppWindow,
  Linux: Terminal,
}

const FEATURE_ICONS = [Cpu, Puzzle, KeyRound, Globe]

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
  const chrome = d.studio.chrome
  const flatDownloads =
    release?.sections.flatMap((section) =>
      section.items.map((item) => ({
        os: section.title as PlatformName,
        label: item.label,
        url: item.url,
      })),
    ) ?? []

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="overflow-x-hidden">
      {/* Hero — design: dual column + grid mask + terminal visual */}
      <section
        data-screen-label="Studio Hero"
        className="relative border-b border-[var(--bx-border)]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(var(--bx-line) 1px, transparent 1px), linear-gradient(90deg, var(--bx-line) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            WebkitMaskImage:
              'radial-gradient(ellipse 80% 90% at 50% 10%, #000 25%, transparent 90%)',
            maskImage:
              'radial-gradient(ellipse 80% 90% at 50% 10%, #000 25%, transparent 90%)',
          }}
        />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-6 pb-16 pt-[72px] lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
          <div>
            <Reveal>
              <p className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
                <span className="h-px w-5 bg-[var(--bx-brand)]" />
                {d.studio.badge}
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="mt-[18px] text-[clamp(38px,4.2vw,56px)] font-extrabold leading-[1.08] tracking-[-0.035em]">
                {d.studio.title1}
                <br />
                <span className="bg-[var(--bx-grad-hero)] bg-clip-text text-transparent">
                  {d.studio.title2}
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-5 max-w-[440px] text-[15px] leading-[1.7] text-[var(--bx-text-muted)]">
                {d.studio.subtitle}
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-[30px] flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => scrollTo('download')}
                  className="bx-btn bx-btn-primary bx-btn-lg"
                >
                  <DownloadIcon size={15} strokeWidth={2.5} />
                  {d.studio.ctaDownload}
                </button>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title={d.common.comingSoon}
                  className="bx-btn bx-btn-ghost bx-btn-lg cursor-not-allowed opacity-60"
                >
                  {d.studio.ctaBrowser}
                  <span className="rounded bg-[var(--bx-brand-soft)] px-[7px] py-0.5 font-mono text-[9.5px] font-semibold text-[var(--bx-brand)]">
                    {d.common.comingSoon}
                  </span>
                </button>
              </div>
            </Reveal>
            <Reveal delay={0.24}>
              <p className="mt-[18px] font-mono text-[11px] text-[var(--bx-text-dim)]">
                {status === 'ready' && release
                  ? `${release.version} · macOS / Windows / Linux · GitHub Releases`
                  : d.studio.heroMeta}
              </p>
            </Reveal>
          </div>

          {/* Terminal visual + floating remote chip */}
          <Reveal delay={0.2} y={32} className="relative">
            <div className="overflow-hidden rounded-[var(--bx-radius-xl)] border border-[var(--bx-border-strong)] bg-[var(--bx-bg-deep)] shadow-[var(--bx-shadow-pop)]">
              <div className="flex items-center gap-2 border-b border-[var(--bx-border)] px-3.5 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-2 font-mono text-[11px] text-[var(--bx-text-dim)]">
                  {chrome.terminalTitle}
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] text-[var(--bx-success)]">
                  <span
                    className="h-[5px] w-[5px] rounded-full bg-current"
                    style={{
                      animation: 'bx-ping 1.8s cubic-bezier(0,0,0.2,1) infinite',
                    }}
                  />
                  {chrome.remoteOn}
                </span>
              </div>
              <div className="space-y-0 px-5 py-[18px] font-mono text-[12.5px] leading-[2]">
                <div>
                  <span className="text-[var(--bx-text-dim)]">$</span>{' '}
                  <span className="text-[var(--bx-text-soft)]">{chrome.cmd}</span>
                </div>
                <div>
                  <span className="text-[var(--bx-success)]">✓</span>{' '}
                  <span className="text-[var(--bx-text-muted)]">{chrome.signedIn}</span>
                </div>
                <div>
                  <span className="text-[var(--bx-brand)]">→</span>{' '}
                  <span className="text-[var(--bx-text-muted)]">{chrome.scan}</span>{' '}
                  <span className="text-[var(--bx-cyan)]">{chrome.scanPath}</span>{' '}
                  <span className="text-[var(--bx-text-dim)]">{chrome.scanMeta}</span>
                </div>
                <div>
                  <span className="text-[var(--bx-brand)]">→</span>{' '}
                  <span className="text-[var(--bx-text-muted)]">{chrome.skillLabel}</span>{' '}
                  <span className="text-[var(--bx-brand-bright)]">{chrome.skillName}</span>{' '}
                  <span className="text-[var(--bx-text-dim)]">{chrome.skillMeta}</span>
                </div>
                <div>
                  <span className="text-[var(--bx-brand)]">→</span>{' '}
                  <span className="text-[var(--bx-text-muted)]">{chrome.write}</span>{' '}
                  <span className="text-[var(--bx-cyan)]">{chrome.writePath}</span>
                </div>
                <div>
                  <span className="text-[var(--bx-success)]">✓</span>{' '}
                  <span className="text-[var(--bx-text-soft)]">{chrome.done}</span>
                  <span className="bx-caret ml-1.5" />
                </div>
              </div>
            </div>
            <div
              aria-hidden
              className="absolute -right-3.5 -bottom-4 flex items-center gap-2.5 whitespace-nowrap rounded-[10px] border border-[var(--bx-border-strong)] bg-[var(--bx-bg-card)] px-3.5 py-2.5 shadow-[var(--bx-shadow-pop)]"
            >
              <Globe size={14} className="text-[var(--bx-brand)]" strokeWidth={2} />
              <span>
                <span className="block text-[10px] text-[var(--bx-text-dim)]">
                  {chrome.remoteLabel}
                </span>
                <span className="block font-mono text-[11.5px] font-semibold">
                  {chrome.browserUrl}
                </span>
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features strip — design: 4 equal cards, no section head */}
      <section
        data-screen-label="Studio 特性"
        className="mx-auto max-w-[1200px] px-6 py-[72px]"
      >
        <Stagger className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {d.studio.features.items.map((item, i) => {
            const Icon = FEATURE_ICONS[i] ?? Cpu
            return (
              <StaggerItem
                key={item.title}
                className="rounded-[var(--bx-radius-lg)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] p-5 shadow-[var(--bx-shadow-card)] transition hover:-translate-y-[3px] hover:border-[var(--bx-brand-ring)]"
              >
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[var(--bx-brand-soft)] text-[var(--bx-brand)]">
                  <Icon size={15} strokeWidth={2} />
                </span>
                <h3 className="mt-3.5 text-[15px] font-extrabold tracking-[-0.02em]">
                  {item.title}
                </h3>
                <p className="mt-[7px] text-[13px] leading-[1.65] text-[var(--bx-text-muted)]">
                  {item.body}
                </p>
              </StaggerItem>
            )
          })}
        </Stagger>
      </section>

      {/* Download — design: 2-col, recommended CTA + flat asset list */}
      <section
        id="download"
        data-screen-label="下载"
        className="scroll-mt-16 border-t border-[var(--bx-border)]"
        style={{
          background: 'color-mix(in srgb, var(--bx-bg-elevated) 55%, transparent)',
        }}
      >
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-6 py-[72px] lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
              <span className="h-px w-5 bg-[var(--bx-brand)]" />
              {d.studio.download.eyebrow}
            </p>
            <h2 className="mt-3.5 text-[32px] font-extrabold tracking-[-0.03em]">
              {d.studio.download.title}
            </h2>
            <p className="mt-3.5 max-w-[400px] text-sm leading-[1.7] text-[var(--bx-text-muted)]">
              {d.studio.download.subtitle}
            </p>
            {status === 'ready' && primaryDownload ? (
              <div
                className="mt-6 w-fit rounded-[var(--bx-radius-lg)] p-[1.5px]"
                style={{
                  background: 'var(--bx-grad-border)',
                  backgroundSize: '300% auto',
                  animation: 'bx-borderflow 8s linear infinite',
                }}
              >
                <a
                  href={primaryDownload.url}
                  rel="noopener"
                  className="inline-flex items-center gap-2.5 rounded-[11px] bg-[var(--bx-bg-deep)] px-[22px] py-3 text-[14.5px] font-bold text-[var(--bx-text)] transition-colors hover:text-[var(--bx-brand-bright)]"
                >
                  {(() => {
                    const Icon = PLATFORM_ICONS[platform]
                    return <Icon size={16} className="text-[var(--bx-brand)]" />
                  })()}
                  {d.studio.download.recommended} · {platform} ({primaryDownload.label})
                  {release ? (
                    <span className="font-mono text-[10.5px] text-[var(--bx-text-dim)]">
                      {release.version}
                    </span>
                  ) : null}
                </a>
              </div>
            ) : null}
            {status === 'loading' ? (
              <p className="mt-6 text-sm text-[var(--bx-text-muted)]">
                {d.studio.download.lookingUp}
              </p>
            ) : null}
            {status === 'error' ? (
              <div className="mt-6">
                <p className="text-sm text-[var(--bx-text-muted)]">
                  {d.studio.download.lookupFailedBody}
                </p>
                <a
                  className="bx-btn bx-btn-primary mt-4 inline-flex"
                  href={RELEASES_PAGE_URL}
                  target="_blank"
                  rel="noopener"
                >
                  {d.studio.download.browseGithub}
                </a>
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] shadow-[var(--bx-shadow-card)]">
            {status === 'ready' && flatDownloads.length > 0
              ? flatDownloads.map((row) => {
                  const Icon = PLATFORM_ICONS[row.os]
                  return (
                    <div
                      key={row.url}
                      className="grid grid-cols-[110px_1fr_auto] items-center gap-4 border-t border-[var(--bx-line)] px-5 py-3 first:border-t-0 transition-colors hover:bg-[var(--bx-hover)]"
                    >
                      <span className="flex items-center gap-2 text-[13px] font-bold">
                        <Icon size={14} className="text-[var(--bx-brand)]" />
                        {row.os}
                      </span>
                      <span className="truncate font-mono text-xs text-[var(--bx-text-muted)]">
                        {row.label}
                      </span>
                      <a
                        href={row.url}
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--bx-brand)] hover:text-[var(--bx-brand-bright)]"
                      >
                        {d.studio.download.downloadLabel}
                        <DownloadIcon size={12} strokeWidth={2.5} />
                      </a>
                    </div>
                  )
                })
              : null}
            {status === 'loading' ? (
              <div className="px-5 py-8 text-center text-sm text-[var(--bx-text-muted)]">
                {d.studio.download.lookingUp}
              </div>
            ) : null}
            {status === 'error' ? (
              <div className="px-5 py-8 text-center text-sm text-[var(--bx-text-muted)]">
                {d.studio.download.lookupFailed}
              </div>
            ) : null}
            <p className="m-0 border-t border-[var(--bx-line)] px-5 py-2.5 font-mono text-[10.5px] text-[var(--bx-text-dim)]">
              {d.studio.download.installTip}{' '}
              <a
                href={RELEASES_PAGE_URL}
                target="_blank"
                rel="noopener"
                className={cx('underline hover:text-[var(--bx-text-soft)]')}
              >
                GitHub Releases
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* FAQ — design: 0.8fr / 2.2fr */}
      <section
        data-screen-label="Studio FAQ"
        className="mx-auto max-w-[1200px] px-6 py-[72px] pb-24"
      >
        <div className="grid gap-10 lg:grid-cols-[0.8fr_2.2fr]">
          <div>
            <p className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
              <span className="h-px w-5 bg-[var(--bx-brand)]" />
              {d.studio.faq.eyebrow}
            </p>
            <h2 className="mt-3.5 text-[30px] font-extrabold tracking-[-0.03em]">
              {d.studio.faq.title}
            </h2>
          </div>
          <Reveal>
            <FaqList items={d.studio.faq.items} idPrefix="studio-faq" />
          </Reveal>
        </div>
      </section>
    </div>
  )
}
