import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND_LOGO_SVG, BRAND_NAME, consoleOrigin } from '@/lib/brand'
import { fetchPublicStatus, type OverallStatus } from '@/lib/public-status'
import { RELEASES_PAGE_URL } from '@/lib/releases'
import { useI18n } from '@/i18n'
import { WORKSPACE_PATHS } from '@/lib/workspace-navigation'
import { cx } from '@/lib/cx'

type FooterStatus = OverallStatus | 'unknown'

export function Footer() {
  const { d } = useI18n()
  const console_ = consoleOrigin()
  const [liveStatus, setLiveStatus] = useState<FooterStatus>('unknown')

  useEffect(() => {
    const ctrl = new AbortController()
    fetchPublicStatus('7d', ctrl.signal)
      .then((data) => {
        if (ctrl.signal.aborted) return
        // Empty or missing payload: never claim "all systems operational".
        if (!data?.items?.length) {
          setLiveStatus('unknown')
          return
        }
        setLiveStatus(data.overall === 'degraded' ? 'degraded' : 'operational')
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLiveStatus('unknown')
      })
    return () => ctrl.abort()
  }, [])

  const statusCopy =
    liveStatus === 'operational'
      ? d.footer.systemsOk
      : liveStatus === 'degraded'
        ? d.footer.systemsDegraded
        : d.footer.systemsUnknown

  const statusTone =
    liveStatus === 'operational'
      ? 'text-[var(--bx-success)]'
      : liveStatus === 'degraded'
        ? 'text-[var(--bx-warning)]'
        : 'text-[var(--bx-text-dim)]'

  const columns: Array<{
    title: string
    links: Array<{ label: string; to?: string; href?: string }>
  }> = [
    {
      title: d.footer.product,
      links: [
        { label: d.footer.creator, to: WORKSPACE_PATHS.createImage },
        { label: d.footer.studio, to: '/studio' },
        { label: d.footer.openApi, to: WORKSPACE_PATHS.developerKeys },
        { label: d.footer.pricing, to: '/pricing' },
      ],
    },
    {
      title: d.footer.resources,
      links: [
        { label: d.footer.status, to: '/status' },
        { label: d.footer.apiKeys, to: WORKSPACE_PATHS.developerKeys },
        { label: d.footer.usage, to: WORKSPACE_PATHS.developerUsage },
        { label: d.footer.github, href: RELEASES_PAGE_URL },
      ],
    },
    {
      title: d.footer.account,
      links: [
        { label: d.footer.login, to: '/login' },
        { label: d.footer.signup, to: '/signup' },
        { label: d.footer.myAccount, to: WORKSPACE_PATHS.home },
      ],
    },
    {
      title: d.footer.legal,
      links: [
        { label: d.footer.terms, href: `${console_}/legal/terms` },
        { label: d.footer.privacy, href: `${console_}/legal/privacy` },
      ],
    },
  ]

  // Layout/copy match design-source/Footer.dc.html
  return (
    <footer className="relative z-10 border-t border-[var(--bx-border)] bg-[var(--bx-bg)] text-[var(--bx-text)]">
      <div className="mx-auto max-w-[1200px] px-6 pt-12 pb-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-[9px] text-[15px] font-extrabold tracking-[-0.02em]">
              <img src={BRAND_LOGO_SVG} alt="" className="h-[26px] w-[26px]" />
              <span>{BRAND_NAME}</span>
            </div>
            <p className="mt-3 max-w-[300px] text-[13px] leading-[1.6] text-[var(--bx-text-muted)]">
              {d.footer.tagline}
            </p>
            <Link
              to="/status"
              className={cx(
                'mt-4 inline-flex items-center gap-[7px] rounded-[6px] border border-[var(--bx-border)] px-2.5 py-[5px] font-mono text-[11px] transition-colors hover:border-[var(--bx-border-strong)]',
                statusTone,
              )}
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-current"
                style={
                  liveStatus === 'unknown'
                    ? undefined
                    : { animation: 'bx-ping 1.8s cubic-bezier(0,0,0.2,1) infinite' }
                }
              />
              {statusCopy}
            </Link>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="m-0 font-mono text-[10.5px] font-semibold tracking-[0.14em] text-[var(--bx-text-dim)] uppercase">
                {col.title}
              </h3>
              <ul className="mt-3.5 flex list-none flex-col gap-[9px] p-0">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link
                        to={link.to}
                        className="text-[13px] text-[var(--bx-text-muted)] transition-colors hover:text-[var(--bx-brand-bright)]"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-[13px] text-[var(--bx-text-muted)] transition-colors hover:text-[var(--bx-brand-bright)]"
                        {...(link.href?.startsWith('https://github.com')
                          ? { target: '_blank', rel: 'noopener' }
                          : {})}
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-[var(--bx-border)] pt-5 sm:flex-row sm:items-center">
          <span className="text-[12.5px] text-[var(--bx-text-dim)]">
            © {new Date().getFullYear()} {BRAND_NAME} · {d.footer.rights}
          </span>
          <span className="font-mono text-[11px] text-[var(--bx-text-dim)]">
            you-box.com · api.you-box.com/v1 · console.you-box.com
          </span>
        </div>
      </div>
    </footer>
  )
}
