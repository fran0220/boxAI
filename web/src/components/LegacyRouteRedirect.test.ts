import { describe, expect, it } from 'vitest'
import { appendLocationParts, LEGACY_ROUTE_MAP } from './LegacyRouteRedirect'

describe('legacy customer routes', () => {
  it('keeps a complete, explicit map for account and creator routes', () => {
    expect(LEGACY_ROUTE_MAP.map((route) => route.from)).toEqual([
      '/account',
      '/account/keys',
      '/account/usage',
      '/account/profile',
      '/account/security',
      '/account/subscription',
      '/account/orders',
      '/account/redeem',
      '/account/affiliate',
      '/account/channels',
      '/account/monitor',
      '/account/batch-image',
      '/account/announcements',
      '/create',
      '/create/image',
      '/create/video',
      '/create/assets',
    ])
  })

  it('preserves query strings and hashes', () => {
    expect(appendLocationParts('/app/create/image', '?model=flux', '#history')).toBe(
      '/app/create/image?model=flux#history',
    )
  })
})
