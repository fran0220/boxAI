import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Bell,
  Boxes,
  Code2,
  ExternalLink,
  Home,
  Laptop,
  LogOut,
  Moon,
  Settings,
  Sun,
  WalletCards,
} from 'lucide-react'
import { BRAND_LOGO_SVG, BRAND_NAME } from '@/lib/brand'
import { logout } from '@/lib/api'
import { useAuth } from '@/lib/use-auth'
import { useTheme } from '@/lib/theme'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import {
  getWorkspaceModule,
  getWorkspaceNavItems,
  workspaceLabel,
  WORKSPACE_MODULES,
  WORKSPACE_PATHS,
  type CapabilityState,
  type WorkspaceModule,
} from '@/lib/workspace-navigation'
import { LangSwitcher } from '@/components/LangSwitcher'
import { useWorkspace } from './WorkspaceContext'

const MODULE_ICONS = {
  home: Home,
  create: Boxes,
  agent: Laptop,
  developer: Code2,
  billing: WalletCards,
  settings: Settings,
}

function availabilityBadge(state: CapabilityState, desktopLabel: string, lockedLabel: string) {
  if (state === 'offline') {
    return (
      <span className="ml-auto rounded border border-[var(--bx-border)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--bx-text-dim)]">
        {desktopLabel}
      </span>
    )
  }
  if (state === 'locked') {
    return (
      <span className="ml-auto rounded border border-[var(--bx-warning-border)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--bx-warning)]">
        {lockedLabel}
      </span>
    )
  }
  return null
}

export function WorkspaceLayout() {
  const { d } = useI18n()
  const { user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { capabilities, customMenuItems, profile } = useWorkspace()
  const location = useLocation()
  const activeModuleId = getWorkspaceModule(location.pathname)
  const activeModule =
    WORKSPACE_MODULES.find((module) => module.id === activeModuleId) ?? WORKSPACE_MODULES[0]
  const secondaryItems = getWorkspaceNavItems(activeModuleId, capabilities)
  const isCreate = activeModuleId === 'create'

  const email = (user?.email as string) || ''
  const username = (user?.username as string) || email || '—'
  const initial = (username || 'U').charAt(0).toUpperCase()
  const balance = typeof profile?.balance === 'number' ? `$${profile.balance.toFixed(2)}` : '—'

  async function onLogout() {
    await logout()
    window.location.href = '/'
  }

  function moduleLink(module: WorkspaceModule, compact = false) {
    const Icon = MODULE_ICONS[module.icon]
    const state = capabilities[module.capability]
    if (state === 'hidden') return null
    const body = (
      <>
        <Icon size={16} strokeWidth={2} />
        <span className="truncate">{workspaceLabel(d, module.label)}</span>
        {!compact
          ? availabilityBadge(state, d.workspace.availability.desktop, d.workspace.availability.locked)
          : null}
      </>
    )

    if (state === 'locked') {
      return (
        <span
          key={module.id}
          aria-disabled="true"
          className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--bx-text-dim)]"
        >
          {body}
        </span>
      )
    }

    return (
      <NavLink
        key={module.id}
        to={module.path}
        end={module.end}
        className={({ isActive }) =>
          cx(
            'flex items-center gap-3 rounded-lg text-sm font-semibold transition-colors',
            compact ? 'min-h-11 shrink-0 whitespace-nowrap px-4 py-2.5' : 'px-3 py-2',
            isActive
              ? 'bg-[var(--bx-active)] text-[var(--bx-brand-bright)]'
              : 'text-[var(--bx-text-muted)] hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]',
          )
        }
      >
        {body}
      </NavLink>
    )
  }

  const customLinks =
    activeModuleId === 'settings'
      ? customMenuItems.map((item) => {
          const external = /^https?:\/\//i.test(item.url) && !item.page_slug
          const slug = item.page_slug || item.id
          const className =
            'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--bx-text-muted)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]'
          return external ? (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {item.label}
              <ExternalLink size={11} />
            </a>
          ) : (
            <NavLink
              key={item.id}
              to={`${WORKSPACE_PATHS.customPage}/${encodeURIComponent(slug)}`}
              className={({ isActive }) =>
                cx(
                  className,
                  isActive && 'bg-[var(--bx-active)] text-[var(--bx-brand-bright)]',
                )
              }
            >
              {item.label}
            </NavLink>
          )
        })
      : []

  return (
    <div className="bx-page min-h-dvh bg-[var(--bx-bg)] text-[var(--bx-text)] lg:grid lg:grid-cols-[216px_minmax(0,1fr)]">
      <aside className="hidden h-dvh flex-col border-r border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] lg:sticky lg:top-0 lg:flex">
        <div className="border-b border-[var(--bx-border)] px-5 py-4">
          <Link to={WORKSPACE_PATHS.home} className="flex items-center gap-2.5 text-[var(--bx-text)]">
            <img src={BRAND_LOGO_SVG} alt="" className="size-7" />
            <div>
              <span className="block text-sm font-extrabold">{BRAND_NAME}</span>
              <span className="block font-mono text-[9px] text-[var(--bx-text-dim)]">
                {d.workspace.title}
              </span>
            </div>
          </Link>
        </div>

        <div className="border-b border-[var(--bx-border)] px-4 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bx-brand-soft)] text-sm font-extrabold text-[var(--bx-brand-bright)]">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-bold">{username}</p>
              <p className="mt-0.5 mb-0 truncate font-mono text-[10px] text-[var(--bx-text-dim)]">
                {email || d.workspace.accountReady}
              </p>
            </div>
          </div>
          <Link
            to={WORKSPACE_PATHS.billingSubscription}
            className="mt-3 flex items-center justify-between rounded-lg border border-[var(--bx-border)] bg-[var(--bx-bg)] px-3 py-2"
          >
            <span className="text-xs text-[var(--bx-text-dim)]">{d.workspace.balance}</span>
            <span className="font-mono text-xs font-bold tabular-nums text-[var(--bx-text)]">
              {balance}
            </span>
          </Link>
        </div>

        <nav aria-label={d.workspace.title} className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {WORKSPACE_MODULES.map((module) => moduleLink(module))}
        </nav>

        <div className="border-t border-[var(--bx-border)] p-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--bx-text-dim)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-danger)]"
          >
            <LogOut size={16} />
            {d.nav.logout}
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--bx-border)] bg-[var(--bx-bg-elevated)]">
          <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
            <Link to={WORKSPACE_PATHS.home} className="flex items-center gap-2 lg:hidden">
              <img src={BRAND_LOGO_SVG} alt="" className="size-7" />
              <span className="text-sm font-extrabold">{BRAND_NAME}</span>
            </Link>
            <div className="hidden min-w-0 lg:block">
              <p className="m-0 text-sm font-extrabold">
                {workspaceLabel(d, activeModule.label)}
              </p>
              <p className="mt-0.5 mb-0 font-mono text-[9px] text-[var(--bx-text-dim)]">
                {d.workspace.accountReady}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link
                to={WORKSPACE_PATHS.billingSubscription}
                className="hidden rounded-lg border border-[var(--bx-border)] px-2.5 py-1.5 font-mono text-xs font-bold tabular-nums text-[var(--bx-text-soft)] sm:block"
              >
                {balance}
              </Link>
              <div className="hidden sm:block">
                <LangSwitcher variant="segmented" />
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--bx-border)] text-[var(--bx-text-muted)] transition-colors hover:text-[var(--bx-brand-bright)]"
                aria-label={isDark ? d.nav.themeDark : d.nav.themeLight}
                title={isDark ? d.nav.themeDark : d.nav.themeLight}
              >
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <Link
                to={WORKSPACE_PATHS.settingsProfile}
                className="flex size-8 items-center justify-center rounded-lg bg-[var(--bx-brand-soft)] text-xs font-extrabold text-[var(--bx-brand-bright)]"
                aria-label={d.accountNav.profile}
              >
                {initial}
              </Link>
            </div>
          </div>

          <nav
            aria-label={d.workspace.mobileModules}
            className="flex gap-1 overflow-x-auto border-t border-[var(--bx-line)] px-3 py-1.5 lg:hidden"
          >
            {WORKSPACE_MODULES.map((module) => moduleLink(module, true))}
          </nav>

          {secondaryItems.length > 0 || customLinks.length > 0 ? (
            <nav
              aria-label={workspaceLabel(d, activeModule.label)}
              className="flex gap-1 overflow-x-auto border-t border-[var(--bx-line)] px-4 py-2 lg:px-6"
            >
              {secondaryItems.map((item) => {
                const state = capabilities[item.capability]
                if (state === 'locked') {
                  return (
                    <span
                      key={item.id}
                      aria-disabled="true"
                      className="flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--bx-text-dim)]"
                    >
                      {workspaceLabel(d, item.label)}
                      {availabilityBadge(
                        state,
                        d.workspace.availability.desktop,
                        d.workspace.availability.locked,
                      )}
                    </span>
                  )
                }
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    className={({ isActive }) =>
                      cx(
                        'flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:min-h-0 sm:py-1.5',
                        isActive
                          ? 'bg-[var(--bx-active)] text-[var(--bx-brand-bright)]'
                          : 'text-[var(--bx-text-muted)] hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]',
                      )
                    }
                  >
                    {item.id === 'notifications' ? <Bell size={12} /> : null}
                    {workspaceLabel(d, item.label)}
                  </NavLink>
                )
              })}
              {customLinks}
            </nav>
          ) : null}
        </header>

        <main
          className={cx(
            'min-w-0 flex-1',
            isCreate
              ? 'flex min-h-0 flex-col'
              : 'mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8',
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
