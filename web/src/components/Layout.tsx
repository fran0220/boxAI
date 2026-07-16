import { Link, NavLink, Outlet } from 'react-router-dom'
import { BRAND_LOGO_SVG, BRAND_NAME, consoleOrigin } from '@/lib/brand'
import { isAuthenticated, getUser, clearSession } from '@/lib/storage'
import { useEffect, useState } from 'react'

const nav = [
  { to: '/studio', label: 'Studio' },
  { to: '/download', label: 'Download' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/create', label: 'Create' },
]

export function Layout() {
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    setAuthed(isAuthenticated())
    const u = getUser()
    setEmail((u?.email as string) || (u?.username as string) || '')
  }, [])

  function onLogout() {
    clearSession()
    setAuthed(false)
    setEmail('')
    window.location.href = '/'
  }

  return (
    <div className="bx-page min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--bx-border)] bg-[color-mix(in_srgb,var(--bx-bg)_85%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <img src={BRAND_LOGO_SVG} alt="" className="h-8 w-8" />
            <span>{BRAND_NAME}</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm ${
                    isActive
                      ? 'bg-[var(--bx-active,rgba(45,212,191,0.12))] text-[var(--bx-teal)]'
                      : 'text-[var(--bx-text-muted)] hover:text-[var(--bx-text)]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {authed ? (
              <>
                <Link
                  to="/account"
                  className="hidden text-sm text-[var(--bx-text-muted)] hover:text-[var(--bx-text)] sm:inline"
                >
                  {email || 'Account'}
                </Link>
                <a
                  href={`${consoleOrigin()}/boxai/sso/start`}
                  className="bx-btn bx-btn-ghost !px-3 !py-1.5 text-xs"
                >
                  Console
                </a>
                <button type="button" onClick={onLogout} className="bx-btn bx-btn-ghost !px-3 !py-1.5 text-xs">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="bx-btn bx-btn-ghost !px-3 !py-1.5 text-xs">
                  Log in
                </Link>
                <Link to="/signup" className="bx-btn bx-btn-primary !px-3 !py-1.5 text-xs">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="mt-20 border-t border-[var(--bx-border)] py-10 text-center text-sm text-[var(--bx-text-dim)]">
        <p>
          © {new Date().getFullYear()} {BRAND_NAME} · you-box.com
        </p>
        <p className="mt-2">
          <a className="underline hover:text-[var(--bx-text-muted)]" href={`${consoleOrigin()}/legal/terms`}>
            Terms
          </a>
          {' · '}
          <a className="underline hover:text-[var(--bx-text-muted)]" href={`${consoleOrigin()}/legal/privacy`}>
            Privacy
          </a>
        </p>
      </footer>
    </div>
  )
}
