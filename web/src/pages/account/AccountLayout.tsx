import { NavLink, Outlet } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'

const links = [
  { to: '/account', end: true, key: 'overview' as const },
  { to: '/account/keys', end: false, key: 'keys' as const },
  { to: '/account/usage', end: false, key: 'usage' as const },
  { to: '/account/subscription', end: false, key: 'subscription' as const },
  { to: '/account/orders', end: false, key: 'orders' as const },
  { to: '/account/profile', end: false, key: 'profile' as const },
  { to: '/account/security', end: false, key: 'security' as const },
  { to: '/account/redeem', end: false, key: 'redeem' as const },
  { to: '/account/affiliate', end: false, key: 'affiliate' as const },
]

export function AccountLayout() {
  const { d } = useI18n()
  const nav = d.accountNav

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:py-14">
      <aside className="shrink-0 lg:w-52">
        <h1 className="bx-display text-xl font-bold tracking-tight">{nav.title}</h1>
        <p className="mt-1 text-xs text-[var(--bx-text-dim)]">{nav.subtitle}</p>
        <nav className="mt-6 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label={nav.title}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cx(
                  'whitespace-nowrap rounded-[var(--bx-radius-sm)] px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-[var(--bx-bg-muted)] font-medium text-[var(--bx-text)]'
                    : 'text-[var(--bx-text-muted)] hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]',
                )
              }
            >
              {nav[link.key]}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
