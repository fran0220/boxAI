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
  getWorkspaceSidebarGroups,
  workspaceGroupLabel,
  workspaceLabel,
  WORKSPACE_MODULES,
  WORKSPACE_PATHS,
  type CapabilityState,
  type WorkspaceModule,
  type WorkspaceSidebarLeaf,
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

const PRODUCT_ICONS = {
  create: Boxes,
  agent: Laptop,
}

function availabilityBadge(state: CapabilityState, desktopLabel: string, lockedLabel: string) {
  if (state === 'offline') {
    return (
      <span className="ml-auto shrink-0 rounded border border-[var(--bx-border)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--bx-text-dim)]">
        {desktopLabel}
      </span>
    )
  }
  if (state === 'locked') {
    return (
      <span className="ml-auto shrink-0 rounded border border-[var(--bx-warning-border)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--bx-warning)]">
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
  const sidebarGroups = getWorkspaceSidebarGroups(capabilities)
  const isCreate = activeModuleId === 'create'
  const isAgent = activeModuleId === 'agent'
  const isCreatePath =
    location.pathname === WORKSPACE_PATHS.create ||
    location.pathname.startsWith(`${WORKSPACE_PATHS.create}/`)
  const paymentAvailable = capabilities.payment === 'available'
  const showCustomOnMobile = activeModuleId === 'settings' && customMenuItems.length > 0

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

  function renderLeaf(leaf: WorkspaceSidebarLeaf, depth = 0) {
    const state = capabilities[leaf.capability]
    if (state === 'hidden') return null

    const hasChildren = Boolean(leaf.children?.length)
    const Icon = leaf.icon ? PRODUCT_ICONS[leaf.icon] : null
    const label = workspaceLabel(d, leaf.label)
    // Always expand create children for density (P1)
    const expandChildren = hasChildren

    const baseClass = cx(
      'bx-create-side-link',
      depth > 0 && 'pl-8 text-[12.5px] font-medium',
      depth === 0 && hasChildren && 'font-semibold',
    )

    const badge = availabilityBadge(
      state,
      d.workspace.availability.desktop,
      d.workspace.availability.locked,
    )

    const content = (
      <>
        {Icon ? (
          <span className="bx-create-side-icon">
            <Icon size={15} strokeWidth={2} />
          </span>
        ) : null}
        <span className="bx-create-side-label">{label}</span>
        {badge}
      </>
    )

    if (state === 'locked') {
      return (
        <div key={leaf.id}>
          <span aria-disabled="true" className={cx(baseClass, 'cursor-not-allowed opacity-70')}>
            {content}
          </span>
          {expandChildren
            ? leaf.children!.map((child) => renderLeaf(child, depth + 1))
            : null}
        </div>
      )
    }

    // Parents with children: section open tint only — children own exact `.is-active`.
    if (hasChildren) {
      return (
        <div key={leaf.id}>
          <Link
            to={leaf.path}
            className={cx(
              baseClass,
              leaf.id === 'create' && isCreatePath && 'font-bold text-[var(--bx-text)]',
            )}
          >
            {content}
          </Link>
          {leaf.children!.map((child) => renderLeaf(child, depth + 1))}
        </div>
      )
    }

    return (
      <div key={leaf.id}>
        <NavLink
          to={leaf.path}
          end={leaf.end}
          className={({ isActive }) => cx(baseClass, isActive ? 'is-active' : undefined)}
        >
          {content}
        </NavLink>
      </div>
    )
  }

  const customLinks = customMenuItems.map((item) => {
    const external = /^https?:\/\//i.test(item.url) && !item.page_slug
    const slug = item.page_slug || item.id
    const className = 'bx-create-side-link text-[12.5px] font-medium'
    return external ? (
      <a
        key={item.id}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        <span className="bx-create-side-label">{item.label}</span>
        <ExternalLink size={11} className="ml-auto shrink-0 text-[var(--bx-text-dim)]" />
      </a>
    ) : (
      <NavLink
        key={item.id}
        to={`${WORKSPACE_PATHS.customPage}/${encodeURIComponent(slug)}`}
        className={({ isActive }) => cx(className, isActive && 'is-active')}
      >
        <span className="bx-create-side-label">{item.label}</span>
      </NavLink>
    )
  })

  // Mobile secondary chips only (desktop leaves live in the rail)
  const mobileSecondary =
    secondaryItems.length > 0 || showCustomOnMobile ? (
      <nav
        aria-label={workspaceLabel(d, activeModule.label)}
        className="flex gap-1 overflow-x-auto border-t border-[var(--bx-line)] px-4 py-2 lg:hidden"
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
        {showCustomOnMobile
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
                    cx(className, isActive && 'bg-[var(--bx-active)] text-[var(--bx-brand-bright)]')
                  }
                >
                  {item.label}
                </NavLink>
              )
            })
          : null}
      </nav>
    ) : null

  return (
    <div className="bx-page min-h-dvh bg-[var(--bx-bg)] text-[var(--bx-text)] lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
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

        <div className="border-b border-[var(--bx-border)] px-4 py-3">
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

          <div className="mt-3 rounded-lg border border-[var(--bx-border)] bg-[var(--bx-bg)] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--bx-text-dim)]">{d.workspace.balance}</span>
              {paymentAvailable ? (
                <Link
                  to={WORKSPACE_PATHS.billingSubscription}
                  className="font-mono text-xs font-bold tabular-nums text-[var(--bx-text)] transition-colors hover:text-[var(--bx-brand-bright)]"
                >
                  {balance}
                </Link>
              ) : (
                <span className="font-mono text-xs font-bold tabular-nums text-[var(--bx-text)]">
                  {balance}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              {paymentAvailable ? (
                <Link
                  to={WORKSPACE_PATHS.billingSubscription}
                  className="flex-1 rounded-md border border-[var(--bx-border)] px-2 py-1 text-center font-mono text-[10px] font-semibold text-[var(--bx-text-muted)] transition-colors hover:border-[var(--bx-brand)] hover:text-[var(--bx-brand-bright)]"
                >
                  {d.accountNav.subscription}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  title={d.workspace.availability.locked}
                  className="flex-1 cursor-not-allowed rounded-md border border-[var(--bx-border)] px-2 py-1 text-center font-mono text-[10px] font-semibold text-[var(--bx-text-dim)] opacity-70"
                >
                  {d.accountNav.subscription}
                </span>
              )}
              {paymentAvailable ? (
                <Link
                  to={WORKSPACE_PATHS.checkout}
                  className="flex-1 rounded-md bg-[var(--bx-grad-cta)] px-2 py-1 text-center font-mono text-[10px] font-bold text-[var(--bx-ink)] transition hover:-translate-y-px"
                >
                  {d.create.topUp}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  title={d.workspace.availability.locked}
                  className="flex-1 cursor-not-allowed rounded-md border border-[var(--bx-border)] px-2 py-1 text-center font-mono text-[10px] font-semibold text-[var(--bx-text-dim)] opacity-70"
                >
                  {d.create.topUp}
                </span>
              )}
            </div>
          </div>
        </div>

        <nav
          aria-label={d.workspace.title}
          className="bx-create-sidebar-nav flex-1 space-y-4 overflow-y-auto px-2 py-3"
        >
          {sidebarGroups.map((group) => (
            <div key={group.id}>
              <p className="bx-create-workspace-label mb-1.5 px-2.5">
                {workspaceGroupLabel(d, group.labelKey)}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => renderLeaf(item))}
                {group.id === 'account' && customLinks.length > 0 ? (
                  <>
                    <p className="bx-create-workspace-label mb-0.5 mt-2 px-2.5">
                      {d.accountNav.groupMore}
                    </p>
                    {customLinks}
                  </>
                ) : null}
              </div>
            </div>
          ))}
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
        {/* Compact sticky chrome: no large title (pages own bx-account-page-title).
            Create routes slim further so CreateShellToolbar is the only product band. */}
        <header
          className={cx(
            'sticky top-0 z-30 border-b border-[var(--bx-border)] bg-[var(--bx-bg-elevated)]',
            isCreate && 'lg:border-b-0',
          )}
        >
          <div
            className={cx(
              'flex items-center gap-3 px-4 lg:px-6',
              isCreate ? 'h-11' : 'h-12',
            )}
          >
            <Link to={WORKSPACE_PATHS.home} className="flex items-center gap-2 lg:hidden">
              <img src={BRAND_LOGO_SVG} alt="" className="size-7" />
              <span className="text-sm font-extrabold">{BRAND_NAME}</span>
            </Link>
            {/* Module crumb only (not a second page title); hidden on create desktop. */}
            {!isCreate ? (
              <p className="m-0 hidden min-w-0 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--bx-text-dim)] lg:block">
                {workspaceLabel(d, activeModule.label)}
              </p>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              {paymentAvailable ? (
                <Link
                  to={WORKSPACE_PATHS.checkout}
                  className="hidden rounded-lg border border-[var(--bx-border)] px-2.5 py-1.5 font-mono text-xs font-bold tabular-nums text-[var(--bx-text-soft)] transition-colors hover:border-[var(--bx-brand)] hover:text-[var(--bx-brand-bright)] sm:block"
                  title={d.create.topUp}
                >
                  {balance}
                </Link>
              ) : (
                <span
                  className="hidden rounded-lg border border-[var(--bx-border)] px-2.5 py-1.5 font-mono text-xs font-bold tabular-nums text-[var(--bx-text-dim)] sm:block"
                  title={d.workspace.availability.locked}
                >
                  {balance}
                </span>
              )}
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

          {mobileSecondary}
        </header>

        <main
          className={cx(
            'min-w-0 flex-1',
            isCreate
              ? 'flex min-h-0 flex-col overflow-hidden'
              : isAgent
                ? 'w-full px-4 pt-4 pb-12 sm:px-6 lg:px-8'
              : 'mx-auto w-full max-w-[1200px] px-4 pt-8 pb-16 sm:px-6 lg:px-8',
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
