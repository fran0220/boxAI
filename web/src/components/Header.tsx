import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { LogOut, Menu, PanelsTopLeft, User, X } from 'lucide-react'
import { BRAND_LOGO_SVG, BRAND_NAME, consoleOrigin } from '@/lib/brand'
import { clearSession } from '@/lib/storage'
import { useAuth } from '@/lib/use-auth'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { LangSwitcher } from './LangSwitcher'

export function Header() {
  const { d } = useI18n()
  const { authed, user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const nav = [
    { to: '/create', label: d.nav.creator },
    { to: '/studio', label: d.nav.studio },
    { to: '/pricing', label: d.nav.pricing },
  ]

  const email = (user?.email as string) || (user?.username as string) || ''

  function onLogout() {
    clearSession()
    window.location.href = '/'
  }

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    cx(
      'rounded-full px-3 py-1.5 text-sm transition-colors',
      isActive
        ? 'bg-[var(--bx-active)] text-[var(--bx-teal)]'
        : 'text-[var(--bx-text-muted)] hover:text-[var(--bx-text)]',
    )

  return (
    <header className="bx-glass sticky top-0 z-40 border-b border-[var(--bx-border)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <img src={BRAND_LOGO_SVG} alt="" className="h-8 w-8" />
          <span>{BRAND_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkCls}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <LangSwitcher />
          {authed ? (
            <div className="hidden items-center gap-1.5 md:flex">
              <Link
                to="/account"
                className="flex max-w-[180px] items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-[var(--bx-text-muted)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
              >
                <User size={15} />
                <span className="truncate">{email || d.nav.account}</span>
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
                className="rounded-full p-2 text-[var(--bx-text-dim)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
                aria-label={d.nav.logout}
                title={d.nav.logout}
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-1.5 md:flex">
              <Link to="/login" className="bx-btn bx-btn-ghost bx-btn-sm">
                {d.nav.login}
              </Link>
              <Link to="/signup" className="bx-btn bx-btn-primary bx-btn-sm">
                {d.nav.signup}
              </Link>
            </div>
          )}
          <button
            type="button"
            className="rounded-full p-2 text-[var(--bx-text-muted)] transition-colors hover:bg-[var(--bx-hover)] md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={d.nav.menu}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-[var(--bx-border)] md:hidden"
          >
            <div className="space-y-1 px-4 py-4">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cx(
                      'block rounded-xl px-3 py-2.5 text-sm',
                      isActive
                        ? 'bg-[var(--bx-active)] text-[var(--bx-teal)]'
                        : 'text-[var(--bx-text-soft)] hover:bg-[var(--bx-hover)]',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="pt-2">
                {authed ? (
                  <div className="space-y-1">
                    <Link
                      to="/account"
                      className="block rounded-xl px-3 py-2.5 text-sm text-[var(--bx-text-soft)] hover:bg-[var(--bx-hover)]"
                    >
                      {email || d.nav.account}
                    </Link>
                    <a
                      href={`${consoleOrigin()}/boxai/sso/start`}
                      className="block rounded-xl px-3 py-2.5 text-sm text-[var(--bx-text-soft)] hover:bg-[var(--bx-hover)]"
                    >
                      {d.nav.console}
                    </a>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-[var(--bx-text-soft)] hover:bg-[var(--bx-hover)]"
                    >
                      {d.nav.logout}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 px-1 pt-1">
                    <Link to="/login" className="bx-btn bx-btn-ghost flex-1">
                      {d.nav.login}
                    </Link>
                    <Link to="/signup" className="bx-btn bx-btn-primary flex-1">
                      {d.nav.signup}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
