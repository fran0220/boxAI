import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { getPublicSettings } from '@/lib/customer-api'
import { useAuth } from '@/lib/use-auth'

type NavKey =
  | 'overview'
  | 'keys'
  | 'usage'
  | 'subscription'
  | 'orders'
  | 'redeem'
  | 'channels'
  | 'monitor'
  | 'batchImage'
  | 'profile'
  | 'security'
  | 'affiliate'
  | 'announcements'

type GroupKey = 'workspace' | 'billing' | 'gateway' | 'account'

const groups: Array<{
  group: GroupKey
  items: Array<{ to: string; end?: boolean; key: NavKey }>
}> = [
  {
    group: 'workspace',
    items: [
      { to: '/account', end: true, key: 'overview' },
      { to: '/account/keys', key: 'keys' },
      { to: '/account/usage', key: 'usage' },
    ],
  },
  {
    group: 'billing',
    items: [
      { to: '/account/subscription', key: 'subscription' },
      { to: '/account/orders', key: 'orders' },
      { to: '/account/redeem', key: 'redeem' },
    ],
  },
  {
    group: 'gateway',
    items: [
      { to: '/account/channels', key: 'channels' },
      { to: '/account/monitor', key: 'monitor' },
      { to: '/account/batch-image', key: 'batchImage' },
    ],
  },
  {
    group: 'account',
    items: [
      { to: '/account/profile', key: 'profile' },
      { to: '/account/security', key: 'security' },
      { to: '/account/affiliate', key: 'affiliate' },
      { to: '/account/announcements', key: 'announcements' },
    ],
  },
]

type CustomMenuItem = {
  id: string
  label: string
  url: string
  page_slug?: string
  visibility?: string
  sort_order?: number
}

export function AccountLayout() {
  const { d } = useI18n()
  const nav = d.accountNav
  const { user } = useAuth()
  const [customItems, setCustomItems] = useState<CustomMenuItem[]>([])

  const email = (user?.email as string) || ''
  const username = (user?.username as string) || email || '—'
  const initial = (email || username || 'U').charAt(0).toUpperCase()

  useEffect(() => {
    let cancelled = false
    getPublicSettings()
      .then((settings) => {
        if (cancelled) return
        const items = (settings.custom_menu_items as CustomMenuItem[] | undefined) || []
        const userItems = items
          .filter((it) => !it.visibility || it.visibility === 'user')
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        setCustomItems(userItems)
      })
      .catch(() => {
        /* optional menu */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'w-full rounded-[6px] px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors',
      isActive
        ? 'bg-[var(--bx-active)] font-semibold text-[var(--bx-brand-bright)]'
        : 'text-[var(--bx-text-muted)] hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]',
    )

  const groupLabel: Record<GroupKey, string> = {
    workspace: nav.groupWorkspace,
    billing: nav.groupBilling,
    gateway: nav.groupGateway,
    account: nav.groupAccount,
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-0 px-6 lg:flex-row">
      <aside
        data-screen-label="AccountNav"
        className="shrink-0 border-[var(--bx-border)] py-8 lg:w-[200px] lg:border-r lg:pr-5"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-[var(--bx-grad-cta)] text-sm font-extrabold text-[var(--bx-ink)]">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="m-0 truncate text-[13px] font-bold">{username}</p>
            {email ? (
              <p className="mt-px m-0 truncate font-mono text-[10.5px] text-[var(--bx-text-dim)]">
                {email}
              </p>
            ) : null}
          </div>
        </div>

        <nav className="mt-6 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label={nav.title}>
          {groups.map((group) => (
            <div key={group.group} className="flex gap-1 lg:mt-6 lg:flex-col lg:gap-0.5">
              <p className="bx-account-nav-group-label hidden lg:block">{groupLabel[group.group]}</p>
              {group.items.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                  {nav[link.key]}
                </NavLink>
              ))}
            </div>
          ))}
          {customItems.length > 0 ? (
            <div className="flex gap-1 lg:mt-6 lg:flex-col lg:gap-0.5">
              <p className="bx-account-nav-group-label hidden lg:block">{nav.groupMore}</p>
              {customItems.map((item) => {
                const slug = item.page_slug || item.id
                const isExternal = Boolean(item.url && /^https?:\/\//i.test(item.url) && !item.page_slug)
                if (isExternal) {
                  return (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full rounded-[6px] px-2.5 py-1.5 text-left text-[13px] font-medium text-[var(--bx-text-muted)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
                    >
                      {item.label}
                    </a>
                  )
                }
                return (
                  <NavLink
                    key={item.id}
                    to={`/account/pages/${encodeURIComponent(slug)}`}
                    className={linkClass}
                  >
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          ) : null}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 py-8 pb-16 lg:pl-8">
        <Outlet />
      </main>
    </div>
  )
}
