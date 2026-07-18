import { describe, expect, it } from 'vitest'
import {
  deriveWorkspaceCapabilities,
  getWorkspaceModule,
  getWorkspaceNavItems,
  getWorkspaceSidebarGroups,
  isUsableRemoteUrl,
  WORKSPACE_PATHS,
  WORKSPACE_SIDEBAR_GROUPS,
} from './workspace-navigation'

describe('workspace capability derivation', () => {
  it('hides the entire workspace for anonymous visitors', () => {
    const capabilities = deriveWorkspaceCapabilities({ authenticated: false })
    expect(Object.values(capabilities).every((state) => state === 'hidden')).toBe(true)
  })

  it('fails closed for optional features without blocking core modules', () => {
    const capabilities = deriveWorkspaceCapabilities({ authenticated: true })
    expect(capabilities.workspace).toBe('available')
    expect(capabilities.create).toBe('available')
    expect(capabilities.developer).toBe('available')
    expect(capabilities.agentRemote).toBe('offline')
    expect(capabilities.payment).toBe('locked')
    expect(capabilities.affiliate).toBe('hidden')
    expect(capabilities.notifications).toBe('hidden')
  })

  it('enables only optional features advertised by public configuration', () => {
    const capabilities = deriveWorkspaceCapabilities({
      authenticated: true,
      publicSettings: {
        payment_enabled: true,
        affiliate_enabled: true,
        balance_low_notify_enabled: true,
      },
      remoteUrl: 'https://studio.example.com',
    })
    expect(capabilities.payment).toBe('available')
    expect(capabilities.affiliate).toBe('available')
    expect(capabilities.notifications).toBe('available')
    expect(capabilities.agentRemote).toBe('available')
  })

  it('does not treat arbitrary text as a remote endpoint', () => {
    expect(isUsableRemoteUrl('studio.example.com')).toBe(false)
    expect(isUsableRemoteUrl('javascript:alert(1)')).toBe(false)
    expect(isUsableRemoteUrl('http://localhost:8787')).toBe(true)
  })
})

describe('workspace navigation', () => {
  it('resolves product modules from canonical paths', () => {
    expect(getWorkspaceModule(WORKSPACE_PATHS.home)).toBe('overview')
    expect(getWorkspaceModule(WORKSPACE_PATHS.createVideo)).toBe('create')
    expect(getWorkspaceModule(WORKSPACE_PATHS.developerModels)).toBe('developer')
    expect(getWorkspaceModule(`${WORKSPACE_PATHS.customPage}/help`)).toBe('settings')
  })

  it('removes hidden capability destinations from module navigation', () => {
    const capabilities = deriveWorkspaceCapabilities({ authenticated: true })
    const billingItems = getWorkspaceNavItems('billing', capabilities)
    expect(billingItems.map((item) => item.id)).not.toContain('affiliate')
    expect(billingItems.find((item) => item.id === 'subscription')?.capability).toBe('payment')
    expect(getWorkspaceNavItems('settings', capabilities).map((item) => item.id)).not.toContain(
      'notifications',
    )
  })
})

describe('workspace sidebar leaf tree', () => {
  it('defines product → platform → billing → account groups', () => {
    expect(WORKSPACE_SIDEBAR_GROUPS.map((g) => g.id)).toEqual([
      'product',
      'platform',
      'billing',
      'account',
    ])
  })

  it('nests create children under the product group', () => {
    const product = WORKSPACE_SIDEBAR_GROUPS.find((g) => g.id === 'product')
    const create = product?.items.find((item) => item.id === 'create')
    expect(create?.path).toBe(WORKSPACE_PATHS.create)
    expect(create?.children?.map((c) => c.id)).toEqual(['image', 'video', 'assets', 'batch'])
    expect(create?.children?.map((c) => c.path)).toContain(WORKSPACE_PATHS.createImage)
    expect(product?.items.map((item) => item.id)).toContain('agent')
  })

  it('places overview with developer leaves under platform', () => {
    const platform = WORKSPACE_SIDEBAR_GROUPS.find((g) => g.id === 'platform')
    expect(platform?.items.map((item) => item.id)).toEqual([
      'overview',
      'keys',
      'usage',
      'models',
      'monitor',
    ])
  })

  it('filters hidden capabilities but keeps locked payment and offline agent', () => {
    const capabilities = deriveWorkspaceCapabilities({ authenticated: true })
    const groups = getWorkspaceSidebarGroups(capabilities)

    const billing = groups.find((g) => g.id === 'billing')
    expect(billing?.items.map((item) => item.id)).toEqual(['subscription', 'orders', 'redeem'])
    expect(billing?.items.find((item) => item.id === 'subscription')).toBeTruthy()

    const account = groups.find((g) => g.id === 'account')
    expect(account?.items.map((item) => item.id)).not.toContain('notifications')
    expect(account?.items.map((item) => item.id)).toContain('announcements')

    const product = groups.find((g) => g.id === 'product')
    expect(product?.items.map((item) => item.id)).toContain('agent')
    expect(capabilities.agentRemote).toBe('offline')
    expect(capabilities.payment).toBe('locked')
  })

  it('surfaces affiliate and notifications when public settings enable them', () => {
    const capabilities = deriveWorkspaceCapabilities({
      authenticated: true,
      publicSettings: {
        payment_enabled: true,
        affiliate_enabled: true,
        balance_low_notify_enabled: true,
      },
    })
    const groups = getWorkspaceSidebarGroups(capabilities)
    expect(groups.find((g) => g.id === 'billing')?.items.map((i) => i.id)).toContain('affiliate')
    expect(groups.find((g) => g.id === 'account')?.items.map((i) => i.id)).toContain(
      'notifications',
    )
  })

  it('uses canonical /app paths for sidebar leaves', () => {
    const flatPaths: string[] = []
    for (const group of WORKSPACE_SIDEBAR_GROUPS) {
      for (const item of group.items) {
        flatPaths.push(item.path)
        for (const child of item.children ?? []) flatPaths.push(child.path)
      }
    }
    expect(flatPaths.every((path) => path.startsWith('/app'))).toBe(true)
    expect(flatPaths).toContain(WORKSPACE_PATHS.developerKeys)
    expect(flatPaths).toContain(WORKSPACE_PATHS.createImage)
  })
})
