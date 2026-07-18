import { describe, expect, it } from 'vitest'
import {
  deriveWorkspaceCapabilities,
  getWorkspaceModule,
  getWorkspaceNavItems,
  isUsableRemoteUrl,
  WORKSPACE_PATHS,
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
