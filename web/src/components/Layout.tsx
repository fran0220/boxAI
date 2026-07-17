import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { cx } from '@/lib/cx'

export function Layout() {
  const { pathname } = useLocation()
  const isCreate = pathname.startsWith('/create')
  // Home supplies its own HeroBackdrop; no second ambient layer.
  const isHome = pathname === '/'

  return (
    <div
      className={cx(
        'bx-page flex min-h-dvh flex-col',
        isHome && 'bx-page--ambient',
        isCreate && 'bx-page--create',
      )}
    >
      <div className="relative z-10 flex min-h-dvh flex-col">
        <Header />
        <main className={cx('flex-1', isCreate && 'flex min-h-0 flex-col')}>
          <Outlet />
        </main>
        {/* Creator keeps site header but uses full remaining height as workspace */}
        {!isCreate ? <Footer /> : null}
      </div>
    </div>
  )
}
