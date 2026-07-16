import { describe, expect, it } from 'vitest'
import { safeReturnPath } from './safe-return'

describe('safeReturnPath', () => {
  it('allows relative paths', () => {
    expect(safeReturnPath('/create')).toBe('/create')
    expect(safeReturnPath('/account?x=1')).toBe('/account?x=1')
    expect(safeReturnPath('/sso/authorize?code_challenge=x')).toContain('/sso/authorize')
  })

  it('allows cold SSO authorize with absolute redirect_uri in query', () => {
    const cold =
      '/sso/authorize?code_challenge=abc&redirect_uri=https://console.you-box.com/boxai/sso/callback&state=xyz'
    expect(safeReturnPath(cold)).toBe(cold)

    const encoded =
      '/sso/authorize?code_challenge=abc&redirect_uri=' +
      encodeURIComponent('https://console.you-box.com/boxai/sso/callback') +
      '&state=xyz'
    expect(safeReturnPath(encoded)).toBe(encoded)
  })

  it('rejects open redirects', () => {
    expect(safeReturnPath('//evil.example')).toBe('/create')
    expect(safeReturnPath('//evil.example/path')).toBe('/create')
    expect(safeReturnPath('https://evil.example')).toBe('/create')
    expect(safeReturnPath('/\\evil')).toBe('/create')
    expect(safeReturnPath('javascript:alert(1)')).toBe('/create')
    // Encoded protocol-relative in pathname
    expect(safeReturnPath('/%2F%2Fevil.example')).toBe('/create')
  })

  it('uses fallback for empty', () => {
    expect(safeReturnPath('', '/login')).toBe('/login')
    expect(safeReturnPath(null)).toBe('/create')
  })
})
