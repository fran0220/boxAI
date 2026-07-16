import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  LogOut,
  Menu,
  Moon,
  PanelsTopLeft,
  Sparkles,
  Sun,
  User,
  X,
} from 'lucide-react'
import { BRAND_LOGO_SVG, BRAND_NAME, consoleOrigin } from '@/lib/brand'
import { logout } from '@/lib/api'
import { useAuth } from '@/lib/use-auth'
import { useTheme } from '@/lib/theme'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { BX_EASE } from '@/components/motion/Reveal'
import { LangSwitcher } from './LangSwitcher'

export function Header() {
  const { d } = useI18n()
  const { authed, user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  const nav = [
    { to: '/create', label: d.nav.creator, match: (p: string) => p.startsWith('/create') },
    { to: '/studio', label: d.nav.studio, match: (p: string) => p.startsWith('/studio') },
    { to: '/pricing', label: d.nav.pricing, match: (p: string) => p.startsWith('/pricing') },
  ]

  const email = (user?.email as string) || (user?.username as string) || ''

  async function onLogout() {
    await logout()
    window.location.href = '/'
  }

  return (
    <header className="bx-nav">
      <div className="bx-nav-inner">
        {/* Brand */}
        <Link to="/" className="bx-nav-brand group">
          <img
            src={BRAND_LOGO_SVG}
            alt=""
            className="h-8 w-8 transition-transform duration-bx ease-expo group-hover:scale-105"
          />
          <span className="bx-display text-[15px] font-semibold tracking-tight">{BRAND_NAME}</span>
        </Link>

        {/* Desktop center nav */}
        <nav className="bx-nav-links" aria-label="Primary">
          <div className="bx-nav-track">
            {nav.map((item) => {
              const active = item.match(location.pathname)
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cx('bx-nav-link', active && 'is-active')}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </NavLink>
              )
            })}
          </div>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-[var(--bx-radius-sm)] p-2 text-[var(--bx-text-muted)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
            aria-label={isDark ? d.nav.themeDark : d.nav.themeLight}
            title={isDark ? d.nav.themeDark : d.nav.themeLight}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <LangSwitcher />

          {authed ? (
            <div className="hidden items-center gap-1.5 md:flex">
              <Link to="/account" className="bx-nav-account" title={email || d.nav.account}>
                <span className="bx-nav-avatar">{(email || 'U').charAt(0).toUpperCase()}</span>
                <span className="max-w-[120px] truncate text-sm">{email || d.nav.account}</span>
              </Link>
              <a
                href={`${consoleOrigin()}/boxai/sso/start`}
                className="bx-btn bx-btn-ghost bx-btn-sm"
              >
                <PanelsTopLeft size={14} />
                {d.nav.console}
              </a>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-[var(--bx-radius-sm)] p-2 text-[var(--bx-text-dim)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
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
              <Link to="/signup" className="bx-btn bx-btn-primary bx-btn-sm">
                <Sparkles size={13} />
                {d.nav.signup}
              </Link>
            </div>
          )}

          <button
            type="button"
            className="rounded-[var(--bx-radius-sm)] p-2 text-[var(--bx-text-muted)] transition-colors hover:bg-[var(--bx-hover)] md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={d.nav.menu}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
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
              className="bx-nav-sheet md:hidden"
            >
              <nav className="space-y-1" aria-label="Mobile">
                {nav.map((item) => {
                  const active = item.match(location.pathname)
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={cx('bx-nav-sheet-link', active && 'is-active')}
                    >
                      {item.label}
                    </NavLink>
                  )
                })}
              </nav>

              <div className="mt-4 border-t border-[var(--bx-border)] pt-4">
                {authed ? (
                  <div className="space-y-1">
                    <Link to="/account" className="bx-nav-sheet-link">
                      <User size={16} />
                      {email || d.nav.account}
                    </Link>
                    <a
                      href={`${consoleOrigin()}/boxai/sso/start`}
                      className="bx-nav-sheet-link"
                    >
                      <PanelsTopLeft size={16} />
                      {d.nav.console}
                    </a>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="bx-nav-sheet-link w-full text-left"
                    >
                      <LogOut size={16} />
                      {d.nav.logout}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link to="/login" className="bx-btn bx-btn-ghost">
                      {d.nav.login}
                    </Link>
                    <Link to="/signup" className="bx-btn bx-btn-primary">
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
