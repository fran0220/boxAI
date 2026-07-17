import { describe, expect, it } from 'vitest'
import { safeReturnPath } from './safe-return'

describe('safeReturnPath', () => {
  it('allows relative paths', () => {
    expect(safeReturnPath('/create')).toBe('/create')
    expect(safeReturnPath('/account?x=1')).toBe('/account?x=1')
    expect(safeReturnPath('/checkout?plan=pro')).toBe('/checkout?plan=pro')
  })

  it('allows absolute redirect_uri only inside query of relative path', () => {
    const withAbs =
      '/login?return_to=' + encodeURIComponent('/checkout?plan=pro')
    expect(safeReturnPath(withAbs)).toBe(withAbs)
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
