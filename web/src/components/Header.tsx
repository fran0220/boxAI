import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Sun,
  User,
  X,
} from 'lucide-react'
import { BRAND_LOGO_SVG, BRAND_NAME } from '@/lib/brand'
import { logout } from '@/lib/api'
import { useAuth } from '@/lib/use-auth'
import { useTheme } from '@/lib/theme'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { BX_EASE } from '@/components/motion/Reveal'
import { LangSwitcher } from './LangSwitcher'

type MenuKey = 'products' | 'solutions' | 'resources' | ''

export function Header() {
  const { d } = useI18n()
  const { authed, user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mega, setMega] = useState<MenuKey>('')
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
    setMega('')
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  const path = location.pathname
  const activeCreator = path.startsWith('/create')
  const activeStudio = path.startsWith('/studio')
  const activePricing = path.startsWith('/pricing')
  const activeStatus = path.startsWith('/status')

  const menus = {
    products: {
      links: [
        { t: d.footer.creator, d: d.home.features.items[0].body, to: '/create' },
        { t: d.footer.studio, d: d.home.features.items[1].body, to: '/studio' },
        { t: d.home.features.items[3].title, d: d.home.features.items[3].body, to: '/account/keys' },
        { t: d.footer.myAccount, d: d.home.features.items[2].body, to: '/account' },
      ],
      feat: {
        k: 'New',
        t: d.home.features.items[3].title,
        d: d.home.features.items[3].body,
        to: '/account/keys',
      },
    },
    solutions: {
      links: [
        { t: d.home.showcase.image.title, d: d.home.showcase.image.body, to: '/create/image' },
        { t: d.home.showcase.video.title, d: d.home.showcase.video.body, to: '/create/video' },
        { t: d.footer.studio, d: d.studio.features.items[0].body, to: '/studio' },
        { t: d.home.features.items[3].title, d: d.home.features.items[3].body, to: '/account/keys' },
      ],
      feat: {
        k: 'Why BoxAI',
        t: d.home.features.title,
        d: d.home.features.subtitle,
        to: '/account',
      },
    },
    resources: {
      links: [
        { t: d.footer.status, d: d.status.homeSubtitle, to: '/status' },
        { t: d.footer.apiKeys, d: d.account.subtitle, to: '/account/keys' },
        { t: d.footer.usage, d: d.account.subtitle, to: '/account/usage' },
        { t: d.home.faq.title, d: d.home.faq.items[0].a, to: '/#faq' },
      ],
      feat: {
        k: 'Status',
        t: d.status.homeTitle,
        d: d.status.homeSubtitle,
        to: '/status',
      },
    },
  } as const

  const openMenu = mega ? menus[mega] : null

  const email = (user?.email as string) || (user?.username as string) || ''

  async function onLogout() {
    await logout()
    window.location.href = '/'
  }

  const navBtn = (active: boolean, open: boolean) =>
    cx(
      'relative inline-flex items-center gap-1 rounded-[6px] px-[11px] py-1.5 text-[13.5px] font-semibold tracking-tight transition-colors',
      active || open
        ? 'text-[var(--bx-text)]'
        : 'text-[var(--bx-text-muted)] hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]',
    )

  return (
    <header
      className="sticky top-0 z-50 border-b border-[var(--bx-border)] bg-[color-mix(in_srgb,var(--bx-bg)_86%,transparent)] backdrop-blur-[16px] backdrop-saturate-[1.2]"
      onMouseLeave={() => setMega('')}
    >
      <div className="mx-auto flex h-[var(--bx-nav-h)] max-w-[1200px] items-center gap-5 px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 text-[var(--bx-text)]">
          <img src={BRAND_LOGO_SVG} alt="" className="h-[26px] w-[26px]" />
          <span className="text-[15px] font-extrabold tracking-tight">{BRAND_NAME}</span>
        </Link>

        <nav aria-label="Primary" className="hidden flex-1 items-center gap-0.5 md:flex">
          <button
            type="button"
            className={navBtn(activeCreator || activeStudio, mega === 'products')}
            onMouseEnter={() => setMega('products')}
          >
            {d.footer.product}
            <ChevronDown
              size={11}
              className={cx('opacity-55 transition-transform duration-200', mega === 'products' && 'rotate-180')}
            />
            {(activeCreator || activeStudio) && <span className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-sm bg-[var(--bx-grad-cta)]" />}
          </button>
          <button
            type="button"
            className={navBtn(false, mega === 'solutions')}
            onMouseEnter={() => setMega('solutions')}
          >
            {d.home.features.eyebrow}
            <ChevronDown
              size={11}
              className={cx('opacity-55 transition-transform duration-200', mega === 'solutions' && 'rotate-180')}
            />
          </button>
          <NavLink
            to="/pricing"
            className={navBtn(activePricing, false)}
            onMouseEnter={() => setMega('')}
          >
            {d.nav.pricing}
            {activePricing && <span className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-sm bg-[var(--bx-grad-cta)]" />}
          </NavLink>
          <button
            type="button"
            className={navBtn(activeStatus, mega === 'resources')}
            onMouseEnter={() => setMega('resources')}
          >
            {d.footer.resources}
            <ChevronDown
              size={11}
              className={cx('opacity-55 transition-transform duration-200', mega === 'resources' && 'rotate-180')}
            />
            {activeStatus && <span className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-sm bg-[var(--bx-grad-cta)]" />}
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-2.5 md:ml-0">
          <div className="hidden sm:block">
            <LangSwitcher variant="segmented" />
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex rounded-[6px] border border-[var(--bx-border)] p-[5px] text-[var(--bx-text-muted)] transition-colors hover:border-[var(--bx-border-strong)] hover:text-[var(--bx-brand-bright)]"
            aria-label={isDark ? d.nav.themeDark : d.nav.themeLight}
            title={isDark ? d.nav.themeDark : d.nav.themeLight}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {authed ? (
            <div className="hidden items-center gap-1.5 md:flex">
              <Link
                to="/account"
                className="inline-flex items-center gap-1.5 rounded-[var(--bx-radius-btn)] bg-[var(--bx-grad-cta)] px-3.5 py-1.5 text-[13px] font-bold tracking-tight text-[var(--bx-ink)] shadow-[var(--bx-shadow-cta)] transition hover:-translate-y-px"
              >
                {d.nav.console}
                <ArrowRight size={13} strokeWidth={2.5} />
              </Link>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-[6px] p-2 text-[var(--bx-text-dim)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
                aria-label={d.nav.logout}
                title={d.nav.logout}
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                to="/login"
                className="rounded-[var(--bx-radius)] px-3 py-1.5 text-sm font-medium text-[var(--bx-text-muted)] transition-colors hover:text-[var(--bx-text)]"
              >
                {d.nav.login}
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center gap-1.5 rounded-[var(--bx-radius-btn)] bg-[var(--bx-grad-cta)] px-3.5 py-1.5 text-[13px] font-bold tracking-tight text-[var(--bx-ink)] shadow-[var(--bx-shadow-cta)] transition hover:-translate-y-px"
              >
                {d.nav.console}
                <ArrowRight size={13} strokeWidth={2.5} />
              </Link>
            </div>
          )}

          <button
            type="button"
            className="rounded-[6px] p-2 text-[var(--bx-text-muted)] transition-colors hover:bg-[var(--bx-hover)] md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={d.nav.menu}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mega menu */}
      <div
        className={cx(
          'absolute inset-x-0 top-full border-b border-[var(--bx-border)] bg-[color-mix(in_srgb,var(--bx-bg)_94%,transparent)] shadow-[0_36px_70px_-28px_rgba(0,0,0,0.55)] backdrop-blur-[20px] transition-[opacity,transform,visibility] duration-240',
          openMenu
            ? 'pointer-events-auto visible translate-y-0 opacity-100'
            : 'pointer-events-none invisible -translate-y-2.5 opacity-0',
        )}
        style={{ transitionTimingFunction: 'var(--bx-ease)' }}
      >
        {openMenu ? (
          <div className="mx-auto grid max-w-[1200px] grid-cols-[2.1fr_1fr] gap-7 px-6 py-[22px] pb-[26px]">
            <div className="grid grid-cols-2 content-start gap-1">
              {openMenu.links.map((l) => (
                <Link
                  key={l.to + l.t}
                  to={l.to}
                  className="flex flex-col gap-0.5 rounded-[10px] px-3.5 py-3 text-[var(--bx-text)] transition-colors hover:bg-[var(--bx-hover)]"
                >
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold tracking-tight">
                    {l.t}
                    <ArrowRight size={12} className="text-[var(--bx-brand)]" strokeWidth={2.5} />
                  </span>
                  <span className="line-clamp-2 text-[12.5px] leading-snug text-[var(--bx-text-muted)]">
                    {l.d}
                  </span>
                </Link>
              ))}
            </div>
            <Link
              to={openMenu.feat.to}
              className="relative flex min-h-[148px] flex-col justify-end gap-1 overflow-hidden rounded-[var(--bx-radius-lg)] border border-[var(--bx-border)] p-[18px] text-[var(--bx-text)] transition hover:-translate-y-0.5 hover:border-[var(--bx-brand-ring)]"
              style={{
                background:
                  'linear-gradient(150deg, color-mix(in srgb, var(--bx-brand) 16%, var(--bx-bg-card)), var(--bx-bg-card) 70%)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -top-10 -right-10 h-[150px] w-[150px] rounded-full blur-[30px]"
                style={{ background: 'radial-gradient(circle, var(--bx-brand-soft), transparent 70%)' }}
              />
              <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[var(--bx-brand)] uppercase">
                {openMenu.feat.k}
              </span>
              <span className="text-[15px] font-extrabold tracking-tight">{openMenu.feat.t}</span>
              <span className="text-xs leading-snug text-[var(--bx-text-muted)]">{openMenu.feat.d}</span>
            </Link>
          </div>
        ) : null}
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              aria-label={d.common.close}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: BX_EASE }}
              className="absolute inset-x-0 top-full z-50 border-b border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] p-4 shadow-[var(--bx-shadow-pop)] md:hidden"
            >
              <nav className="space-y-1" aria-label="Mobile">
                {[
                  { to: '/create', label: d.nav.creator },
                  { to: '/studio', label: d.nav.studio },
                  { to: '/pricing', label: d.nav.pricing },
                  { to: '/status', label: d.nav.status },
                ].map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cx(
                        'flex rounded-[var(--bx-radius)] px-3 py-2.5 text-sm font-semibold transition-colors',
                        isActive
                          ? 'bg-[var(--bx-active)] text-[var(--bx-brand-bright)]'
                          : 'text-[var(--bx-text-soft)] hover:bg-[var(--bx-hover)]',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="mt-3 flex items-center gap-2">
                <LangSwitcher variant="segmented" />
              </div>
              <div className="mt-4 border-t border-[var(--bx-border)] pt-4">
                {authed ? (
                  <div className="space-y-1">
                    <Link
                      to="/account"
                      className="flex items-center gap-2 rounded-[var(--bx-radius)] px-3 py-2.5 text-sm font-semibold hover:bg-[var(--bx-hover)]"
                    >
                      <User size={16} />
                      {email || d.nav.account}
                    </Link>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="flex w-full items-center gap-2 rounded-[var(--bx-radius)] px-3 py-2.5 text-left text-sm font-semibold hover:bg-[var(--bx-hover)]"
                    >
                      <LogOut size={16} />
                      {d.nav.logout}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/login"
                      className="rounded-[var(--bx-radius-btn)] border border-[var(--bx-border)] px-3 py-2 text-center text-sm font-semibold"
                    >
                      {d.nav.login}
                    </Link>
                    <Link
                      to="/signup"
                      className="rounded-[var(--bx-radius-btn)] bg-[var(--bx-grad-cta)] px-3 py-2 text-center text-sm font-bold text-[var(--bx-ink)]"
                    >
                      {d.nav.signup}
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
