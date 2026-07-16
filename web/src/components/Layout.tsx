import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { AuroraBackground } from './brand/AuroraBackground'
import { cx } from '@/lib/cx'

export function Layout() {
  const { pathname } = useLocation()
  const ambientHome = pathname === '/'
  const isCreate = pathname.startsWith('/create')

  return (
    <div
      className={cx(
        'bx-page flex min-h-dvh flex-col',
        ambientHome && 'bx-page--ambient',
        isCreate && 'bx-page--create',
      )}
    >
      {ambientHome ? <AuroraBackground className="fixed inset-0" /> : null}
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
