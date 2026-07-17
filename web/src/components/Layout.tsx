import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { cx } from '@/lib/cx'

/** Full-bleed auth shell: no site chrome (design split layout owns the viewport). */
function isAuthPath(pathname: string): boolean {
  if (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'
  ) {
    return true
  }
  return pathname.startsWith('/auth/')
}

export function Layout() {
  const { pathname } = useLocation()
  const isCreate = pathname.startsWith('/create')
  const isAuth = isAuthPath(pathname)
  // Home supplies its own HeroBackdrop; no second ambient layer.
  const isHome = pathname === '/'

  return (
    <div
      className={cx(
        'bx-page flex min-h-dvh flex-col',
        isHome && 'bx-page--ambient',
        isCreate && 'bx-page--create',
        isAuth && 'bx-page--auth',
      )}
    >
      <div className="relative z-10 flex min-h-dvh flex-col">
        {!isAuth ? <Header /> : null}
        <main className={cx('flex-1', isCreate && 'flex min-h-0 flex-col', isAuth && 'flex min-h-0 flex-col')}>
          <Outlet />
        </main>
        {/* Creator keeps site header but uses full remaining height as workspace */}
        {!isCreate && !isAuth ? <Footer /> : null}
      </div>
    </div>
  )
}
