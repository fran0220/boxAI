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
        { label: d.footer.status, to: '/status' },
      ],
    },
    {
      title: d.footer.resources,
      links: [
        { label: d.footer.apiKeys, to: '/account/keys' },
        { label: d.footer.usage, to: '/account/usage' },
        { label: d.footer.myAccount, to: '/account' },
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
    <footer className="relative z-10 border-t border-[var(--bx-border)]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <div className="bx-display flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
              <img src={BRAND_LOGO_SVG} alt="" className="h-8 w-8" />
              <span>{BRAND_NAME}</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--bx-text-muted)]">
              {d.footer.tagline}
            </p>
            <div className="mt-4">
              <LangSwitcher align="left" />
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="bx-display text-sm font-semibold tracking-tight text-[var(--bx-text-soft)]">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link
                        to={link.to}
                        className="text-sm text-[var(--bx-text-muted)] transition-colors hover:text-[var(--bx-brand-bright)]"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-[var(--bx-text-muted)] transition-colors hover:text-[var(--bx-brand-bright)]"
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
