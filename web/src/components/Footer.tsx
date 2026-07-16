import { Link } from 'react-router-dom'
import { BRAND_LOGO_SVG, BRAND_NAME, consoleOrigin } from '@/lib/brand'
import { RELEASES_PAGE_URL } from '@/lib/releases'
import { useI18n } from '@/i18n'
import { LangSwitcher } from './LangSwitcher'

export function Footer() {
  const { d } = useI18n()
  const console_ = consoleOrigin()

  const columns: Array<{
    title: string
    links: Array<{ label: string; to?: string; href?: string }>
  }> = [
    {
      title: d.footer.product,
      links: [
        { label: d.footer.creator, to: '/create' },
        { label: d.footer.studio, to: '/studio' },
        { label: d.footer.pricing, to: '/pricing' },
      ],
    },
    {
      title: d.footer.resources,
      links: [
        { label: d.footer.console, href: `${console_}/boxai/sso/start` },
        { label: d.footer.apiKeys, href: `${console_}/boxai/sso/start?return_to=${encodeURIComponent('/keys')}` },
        { label: d.footer.usage, href: `${console_}/boxai/sso/start?return_to=${encodeURIComponent('/usage')}` },
        { label: d.footer.github, href: RELEASES_PAGE_URL },
      ],
    },
    {
      title: d.footer.account,
      links: [
        { label: d.footer.login, to: '/login' },
        { label: d.footer.signup, to: '/signup' },
        { label: d.footer.myAccount, to: '/account' },
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

  return (
    <footer className="border-t border-[var(--bx-border)]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 font-semibold">
              <img src={BRAND_LOGO_SVG} alt="" className="h-8 w-8" />
              <span>{BRAND_NAME}</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-[var(--bx-text-muted)]">{d.footer.tagline}</p>
            <div className="mt-4">
              <LangSwitcher align="left" />
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-[var(--bx-text-soft)]">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link
                        to={link.to}
                        className="text-sm text-[var(--bx-text-muted)] transition-colors hover:text-[var(--bx-text)]"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-[var(--bx-text-muted)] transition-colors hover:text-[var(--bx-text)]"
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
        <div className="mt-12 border-t border-[var(--bx-border)] pt-6 text-sm text-[var(--bx-text-dim)]">
          © {new Date().getFullYear()} {BRAND_NAME} · you-box.com · {d.footer.rights}
        </div>
      </div>
    </footer>
  )
}
