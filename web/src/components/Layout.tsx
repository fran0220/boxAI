import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'

/** Marketing, pricing, status, and transactional customer pages. */
export function PublicLayout() {
  return (
    <div className="bx-page flex min-h-dvh flex-col">
      <div className="relative z-10 flex min-h-dvh flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}

/** Full-bleed auth shell: the split auth page owns the viewport and focus order. */
export function AuthLayout() {
  return (
    <div className="bx-page bx-page--auth flex min-h-dvh flex-col">
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}
