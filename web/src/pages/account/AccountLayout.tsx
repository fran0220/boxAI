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

type GroupKey = 'workspace' | 'billing' | 'platform' | 'account'

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
    group: 'platform',
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

  // Design mono group headers stay English (Workspace / Billing / Platform / Account)
  const groupLabel: Record<GroupKey, string> = {
    workspace: nav.groupWorkspace,
    billing: nav.groupBilling,
    platform: nav.groupPlatform || nav.groupGateway,
    account: nav.groupAccount,
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx('bx-account-nav-link', isActive && 'is-active')

  return (
    <div className="bx-account-shell">
      <aside data-screen-label="AccountNav" className="bx-account-aside">
        <div className="bx-account-user">
          <div className="bx-account-avatar" aria-hidden>
            {initial}
          </div>
          <div className="min-w-0">
            <p className="bx-account-username">{username}</p>
            {email ? <p className="bx-account-email">{email}</p> : null}
          </div>
        </div>

        <nav className="bx-account-nav" aria-label={nav.title}>
          {groups.map((group) => (
            <div key={group.group} className="bx-account-nav-group">
              <p className="bx-account-nav-group-label">{groupLabel[group.group]}</p>
              <div className="bx-account-nav-items">
                {group.items.map((link) => (
                  <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                    {nav[link.key]}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
          {customItems.length > 0 ? (
            <div className="bx-account-nav-group">
              <p className="bx-account-nav-group-label">{nav.groupMore}</p>
              <div className="bx-account-nav-items">
                {customItems.map((item) => {
                  const slug = item.page_slug || item.id
                  const isExternal = Boolean(
                    item.url && /^https?:\/\//i.test(item.url) && !item.page_slug,
                  )
                  if (isExternal) {
                    return (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bx-account-nav-link"
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
            </div>
          ) : null}
        </nav>
      </aside>
      <main className="bx-account-main">
        <Outlet />
      </main>
    </div>
  )
}
