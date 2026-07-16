import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBoxaiRequestHeaders, isBoxaiGatewayUrl, resolveAuthHeaders, getBoxaiGatewayBaseUrl } from './boxaiAuth'

vi.mock('@/lib/brand', () => ({
  apiBase: vi.fn(() => ''),
}))

vi.mock('@/lib/session', () => ({
  getAccessToken: vi.fn(() => 'test-jwt-token'),
  sessionRequestHeaders: vi.fn(() => ({ 'X-BoxAI-Browser-Session': '1', 'X-BoxAI-CSRF': '1' })),
}))

import { apiBase } from '@/lib/brand'
import { getAccessToken } from '@/lib/session'

describe('boxaiAuth', () => {
  afterEach(() => {
    vi.mocked(apiBase).mockReturnValue('')
    vi.mocked(getAccessToken).mockReturnValue('test-jwt-token')
  })

  it('treats same-origin /v1 paths as gateway when apiBase is empty', () => {
    expect(isBoxaiGatewayUrl('/v1/images/generations')).toBe(true)
    expect(isBoxaiGatewayUrl('http://evil.example/v1/images/generations')).toBe(false)
  })

  it('injects JWT only for gateway URLs', () => {
    const ok = resolveAuthHeaders('stored-key', '/v1/images/generations')
    expect(ok.Authorization).toBe('Bearer test-jwt-token')

    const blocked = resolveAuthHeaders('stored-key', 'https://evil.example/v1/images/generations')
    // Non-gateway may use profile key (third-party), never the session JWT path when origin mismatches
    expect(blocked.Authorization).toBe('Bearer stored-key')
  })

  it('does not attach Authorization to third-party when profile key empty', () => {
    const headers = resolveAuthHeaders('', 'https://evil.example/api')
    expect(headers.Authorization).toBeUndefined()
  })

  it('strips BoxAI credential and security headers from third-party requests', () => {
    const headers = createBoxaiRequestHeaders('https://evil.example/api', {
      Authorization: 'Bearer boxai-token',
      'X-BoxAI-Browser-Session': '1',
      'X-BoxAI-CSRF': '1',
      'X-Custom': 'safe',
    })
    expect(headers).toEqual({ 'X-Custom': 'safe' })
  })

  it('builds gateway base URL with /v1 suffix for absolute apiBase', () => {
    vi.mocked(apiBase).mockReturnValue('https://api.you-box.com')
    expect(getBoxaiGatewayBaseUrl()).toBe('https://api.you-box.com/v1')
  })

  it('returns empty base for same-origin apiBase', () => {
    vi.mocked(apiBase).mockReturnValue('')
    expect(getBoxaiGatewayBaseUrl()).toBe('')
  })
})
