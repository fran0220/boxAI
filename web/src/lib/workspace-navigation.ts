import type { Dict } from '@/i18n/zh'

export type CapabilityState = 'available' | 'locked' | 'hidden' | 'offline'

export type WorkspaceCapabilityKey =
  | 'workspace'
  | 'create'
  | 'agentRemote'
  | 'developer'
  | 'billing'
  | 'payment'
  | 'affiliate'
  | 'settings'
  | 'notifications'

export type WorkspaceCapabilities = Record<WorkspaceCapabilityKey, CapabilityState>

export type WorkspaceModuleId =
  | 'overview'
  | 'create'
  | 'agent'
  | 'developer'
  | 'billing'
  | 'settings'

export type WorkspaceLabelKey =
  | 'overview'
  | 'create'
  | 'agent'
  | 'developer'
  | 'billing'
  | 'settings'
  | 'image'
  | 'video'
  | 'assets'
  | 'batch'
  | 'keys'
  | 'usage'
  | 'models'
  | 'monitor'
  | 'subscription'
  | 'orders'
  | 'redeem'
  | 'affiliate'
  | 'profile'
  | 'security'
  | 'notifications'
  | 'announcements'

export type SidebarGroupId = 'product' | 'platform' | 'billing' | 'account'

/** Maps to `accountNav.group*` i18n keys. */
export type SidebarGroupLabelKey =
  | 'groupWorkspace'
  | 'groupPlatform'
  | 'groupBilling'
  | 'groupAccount'

export const WORKSPACE_PATHS = {
  home: '/app',
  create: '/app/create',
  createImage: '/app/create/image',
  createVideo: '/app/create/video',
  createAssets: '/app/create/assets',
  createBatch: '/app/create/batch',
  agent: '/app/agent',
  developer: '/app/developer',
  developerKeys: '/app/developer/keys',
  developerUsage: '/app/developer/usage',
  developerModels: '/app/developer/models',
  developerMonitor: '/app/developer/monitor',
  billing: '/app/billing',
  billingSubscription: '/app/billing/subscription',
  billingOrders: '/app/billing/orders',
  billingRedeem: '/app/billing/redeem',
  billingAffiliate: '/app/billing/affiliate',
  settings: '/app/settings',
  settingsProfile: '/app/settings/profile',
  settingsSecurity: '/app/settings/security',
  settingsNotifications: '/app/settings/notifications',
  settingsAnnouncements: '/app/settings/announcements',
  customPage: '/app/pages',
  checkout: '/checkout',
} as const

export interface WorkspaceNavItem {
  id: string
  module: WorkspaceModuleId
  label: WorkspaceLabelKey
  path: string
  capability: WorkspaceCapabilityKey
  end?: boolean
}

export interface WorkspaceModule {
  id: WorkspaceModuleId
  label: WorkspaceLabelKey
  path: string
  capability: WorkspaceCapabilityKey
  icon: 'home' | 'create' | 'agent' | 'developer' | 'billing' | 'settings'
  end?: boolean
}

/** Leaf or parent row in the desktop left rail (full discoverability tree). */
export interface WorkspaceSidebarLeaf {
  id: string
  label: WorkspaceLabelKey
  path: string
  capability: WorkspaceCapabilityKey
  end?: boolean
  /** Icons only for product entries (create / agent). */
  icon?: 'create' | 'agent'
  children?: readonly WorkspaceSidebarLeaf[]
}

export interface WorkspaceSidebarGroup {
  id: SidebarGroupId
  labelKey: SidebarGroupLabelKey
  items: readonly WorkspaceSidebarLeaf[]
}

export const WORKSPACE_MODULES: readonly WorkspaceModule[] = [
  {
    id: 'overview',
    label: 'overview',
    path: WORKSPACE_PATHS.home,
    capability: 'workspace',
    icon: 'home',
    end: true,
  },
  {
    id: 'create',
    label: 'create',
    path: WORKSPACE_PATHS.createImage,
    capability: 'create',
    icon: 'create',
  },
  {
    id: 'agent',
    label: 'agent',
    path: WORKSPACE_PATHS.agent,
    capability: 'agentRemote',
    icon: 'agent',
  },
  {
    id: 'developer',
    label: 'developer',
    path: WORKSPACE_PATHS.developerKeys,
    capability: 'developer',
    icon: 'developer',
  },
  {
    id: 'billing',
    label: 'billing',
    path: WORKSPACE_PATHS.billingSubscription,
    capability: 'billing',
    icon: 'billing',
  },
  {
    id: 'settings',
    label: 'settings',
    path: WORKSPACE_PATHS.settingsProfile,
    capability: 'settings',
    icon: 'settings',
  },
] as const

export const WORKSPACE_NAV_ITEMS: readonly WorkspaceNavItem[] = [
  { id: 'image', module: 'create', label: 'image', path: WORKSPACE_PATHS.createImage, capability: 'create' },
  { id: 'video', module: 'create', label: 'video', path: WORKSPACE_PATHS.createVideo, capability: 'create' },
  { id: 'assets', module: 'create', label: 'assets', path: WORKSPACE_PATHS.createAssets, capability: 'create' },
  { id: 'batch', module: 'create', label: 'batch', path: WORKSPACE_PATHS.createBatch, capability: 'create' },
  { id: 'keys', module: 'developer', label: 'keys', path: WORKSPACE_PATHS.developerKeys, capability: 'developer' },
  { id: 'usage', module: 'developer', label: 'usage', path: WORKSPACE_PATHS.developerUsage, capability: 'developer' },
  { id: 'models', module: 'developer', label: 'models', path: WORKSPACE_PATHS.developerModels, capability: 'developer' },
  { id: 'monitor', module: 'developer', label: 'monitor', path: WORKSPACE_PATHS.developerMonitor, capability: 'developer' },
  {
    id: 'subscription',
    module: 'billing',
    label: 'subscription',
    path: WORKSPACE_PATHS.billingSubscription,
    capability: 'payment',
  },
  { id: 'orders', module: 'billing', label: 'orders', path: WORKSPACE_PATHS.billingOrders, capability: 'billing' },
  { id: 'redeem', module: 'billing', label: 'redeem', path: WORKSPACE_PATHS.billingRedeem, capability: 'billing' },
  {
    id: 'affiliate',
    module: 'billing',
    label: 'affiliate',
    path: WORKSPACE_PATHS.billingAffiliate,
    capability: 'affiliate',
  },
  { id: 'profile', module: 'settings', label: 'profile', path: WORKSPACE_PATHS.settingsProfile, capability: 'settings' },
  { id: 'security', module: 'settings', label: 'security', path: WORKSPACE_PATHS.settingsSecurity, capability: 'settings' },
  {
    id: 'notifications',
    module: 'settings',
    label: 'notifications',
    path: WORKSPACE_PATHS.settingsNotifications,
    capability: 'notifications',
  },
  {
    id: 'announcements',
    module: 'settings',
    label: 'announcements',
    path: WORKSPACE_PATHS.settingsAnnouncements,
    capability: 'settings',
  },
] as const

/** Canonical desktop sidebar: product → platform → billing → account. */
export const WORKSPACE_SIDEBAR_GROUPS: readonly WorkspaceSidebarGroup[] = [
  {
    id: 'product',
    labelKey: 'groupWorkspace',
    items: [
      {
        id: 'create',
        label: 'create',
        // Parent routes to /app/create (index → image); children own exact active state.
        path: WORKSPACE_PATHS.create,
        capability: 'create',
        icon: 'create',
        children: [
          {
            id: 'image',
            label: 'image',
            path: WORKSPACE_PATHS.createImage,
            capability: 'create',
          },
          {
            id: 'video',
            label: 'video',
            path: WORKSPACE_PATHS.createVideo,
            capability: 'create',
          },
          {
            id: 'assets',
            label: 'assets',
            path: WORKSPACE_PATHS.createAssets,
            capability: 'create',
          },
          {
            id: 'batch',
            label: 'batch',
            path: WORKSPACE_PATHS.createBatch,
            capability: 'create',
          },
        ],
      },
      {
        id: 'agent',
        label: 'agent',
        path: WORKSPACE_PATHS.agent,
        capability: 'agentRemote',
        icon: 'agent',
      },
    ],
  },
  {
    id: 'platform',
    labelKey: 'groupPlatform',
    items: [
      {
        id: 'overview',
        label: 'overview',
        path: WORKSPACE_PATHS.home,
        capability: 'workspace',
        end: true,
      },
      {
        id: 'keys',
        label: 'keys',
        path: WORKSPACE_PATHS.developerKeys,
        capability: 'developer',
      },
      {
        id: 'usage',
        label: 'usage',
        path: WORKSPACE_PATHS.developerUsage,
        capability: 'developer',
      },
      {
        id: 'models',
        label: 'models',
        path: WORKSPACE_PATHS.developerModels,
        capability: 'developer',
      },
      {
        id: 'monitor',
        label: 'monitor',
        path: WORKSPACE_PATHS.developerMonitor,
        capability: 'developer',
      },
    ],
  },
  {
    id: 'billing',
    labelKey: 'groupBilling',
    items: [
      {
        id: 'subscription',
        label: 'subscription',
        path: WORKSPACE_PATHS.billingSubscription,
        capability: 'payment',
      },
      {
        id: 'orders',
        label: 'orders',
        path: WORKSPACE_PATHS.billingOrders,
        capability: 'billing',
      },
      {
        id: 'redeem',
        label: 'redeem',
        path: WORKSPACE_PATHS.billingRedeem,
        capability: 'billing',
      },
      {
        id: 'affiliate',
        label: 'affiliate',
        path: WORKSPACE_PATHS.billingAffiliate,
        capability: 'affiliate',
      },
    ],
  },
  {
    id: 'account',
    labelKey: 'groupAccount',
    items: [
      {
        id: 'profile',
        label: 'profile',
        path: WORKSPACE_PATHS.settingsProfile,
        capability: 'settings',
      },
      {
        id: 'security',
        label: 'security',
        path: WORKSPACE_PATHS.settingsSecurity,
        capability: 'settings',
      },
      {
        id: 'notifications',
        label: 'notifications',
        path: WORKSPACE_PATHS.settingsNotifications,
        capability: 'notifications',
      },
      {
        id: 'announcements',
        label: 'announcements',
        path: WORKSPACE_PATHS.settingsAnnouncements,
        capability: 'settings',
      },
    ],
  },
] as const

export interface CapabilityInputs {
  authenticated: boolean
  publicSettings?: Record<string, unknown> | null
  remoteUrl?: string | null
}

export function isUsableRemoteUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * UX capability derivation only. API authorization, resource ownership, and
 * billing enforcement remain server-side and must not depend on these values.
 */
export function deriveWorkspaceCapabilities({
  authenticated,
  publicSettings,
  remoteUrl,
}: CapabilityInputs): WorkspaceCapabilities {
  if (!authenticated) {
    return {
      workspace: 'hidden',
      create: 'hidden',
      agentRemote: 'hidden',
      developer: 'hidden',
      billing: 'hidden',
      payment: 'hidden',
      affiliate: 'hidden',
      settings: 'hidden',
      notifications: 'hidden',
    }
  }

  return {
    workspace: 'available',
    create: 'available',
    agentRemote: isUsableRemoteUrl(remoteUrl) ? 'available' : 'offline',
    developer: 'available',
    billing: 'available',
    payment: publicSettings?.payment_enabled === true ? 'available' : 'locked',
    affiliate: publicSettings?.affiliate_enabled === true ? 'available' : 'hidden',
    settings: 'available',
    notifications:
      publicSettings?.balance_low_notify_enabled === true ? 'available' : 'hidden',
  }
}

export function getWorkspaceModule(pathname: string): WorkspaceModuleId {
  if (pathname === WORKSPACE_PATHS.home) return 'overview'
  if (pathname.startsWith(`${WORKSPACE_PATHS.create}/`) || pathname === WORKSPACE_PATHS.create) {
    return 'create'
  }
  if (pathname.startsWith(WORKSPACE_PATHS.agent)) return 'agent'
  if (pathname.startsWith(`${WORKSPACE_PATHS.developer}/`) || pathname === WORKSPACE_PATHS.developer) {
    return 'developer'
  }
  if (pathname.startsWith(`${WORKSPACE_PATHS.billing}/`) || pathname === WORKSPACE_PATHS.billing) {
    return 'billing'
  }
  if (
    pathname.startsWith(`${WORKSPACE_PATHS.settings}/`) ||
    pathname === WORKSPACE_PATHS.settings ||
    pathname.startsWith(`${WORKSPACE_PATHS.customPage}/`)
  ) {
    return 'settings'
  }
  return 'overview'
}

export function getWorkspaceNavItems(
  module: WorkspaceModuleId,
  capabilities: WorkspaceCapabilities,
): WorkspaceNavItem[] {
  return WORKSPACE_NAV_ITEMS.filter(
    (item) => item.module === module && capabilities[item.capability] !== 'hidden',
  )
}

function filterSidebarLeaf(
  leaf: WorkspaceSidebarLeaf,
  capabilities: WorkspaceCapabilities,
): WorkspaceSidebarLeaf | null {
  if (capabilities[leaf.capability] === 'hidden') return null
  if (!leaf.children?.length) return leaf
  const children = leaf.children
    .map((child) => filterSidebarLeaf(child, capabilities))
    .filter((child): child is WorkspaceSidebarLeaf => child != null)
  return { ...leaf, children }
}

/**
 * Full left-rail tree with capability filtering (hidden items removed;
 * locked / offline remain so badges can render).
 */
export function getWorkspaceSidebarGroups(
  capabilities: WorkspaceCapabilities,
): WorkspaceSidebarGroup[] {
  return WORKSPACE_SIDEBAR_GROUPS.map((group) => ({
    id: group.id,
    labelKey: group.labelKey,
    items: group.items
      .map((item) => filterSidebarLeaf(item, capabilities))
      .filter((item): item is WorkspaceSidebarLeaf => item != null),
  })).filter((group) => group.items.length > 0)
}

export function workspaceGroupLabel(d: Dict, key: SidebarGroupLabelKey): string {
  return d.accountNav[key]
}

export function workspaceLabel(d: Dict, key: WorkspaceLabelKey): string {
  const labels: Record<WorkspaceLabelKey, string> = {
    overview: d.accountNav.overview,
    create: d.workspace.modules.create,
    agent: d.workspace.modules.agent,
    developer: d.workspace.modules.developer,
    billing: d.workspace.modules.billing,
    settings: d.workspace.modules.settings,
    image: d.create.nav.image,
    video: d.create.nav.video,
    assets: d.create.nav.assets,
    batch: d.accountNav.batchImage,
    keys: d.accountNav.keys,
    usage: d.accountNav.usage,
    models: d.workspace.models,
    monitor: d.accountNav.monitor,
    subscription: d.accountNav.subscription,
    orders: d.accountNav.orders,
    redeem: d.accountNav.redeem,
    affiliate: d.accountNav.affiliate,
    profile: d.accountNav.profile,
    security: d.accountNav.security,
    notifications: d.workspace.notifications,
    announcements: d.accountNav.announcements,
  }
  return labels[key]
}
