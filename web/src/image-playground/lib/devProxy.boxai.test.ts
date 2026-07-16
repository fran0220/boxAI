import { describe, expect, it } from 'vitest'
import { buildApiUrl, normalizeBaseUrl } from './devProxy'

describe('buildApiUrl (BoxAI embed)', () => {
  it('empty baseUrl yields same-origin /v1/... path', () => {
    expect(buildApiUrl('', 'images/generations')).toBe('/v1/images/generations')
    expect(buildApiUrl('', 'images/edits')).toBe('/v1/images/edits')
    expect(buildApiUrl('', 'responses')).toBe('/v1/responses')
  })

  it('absolute base ending with /v1 does not double-prefix', () => {
    expect(buildApiUrl('https://api.you-box.com/v1', 'images/generations')).toBe(
      'https://api.you-box.com/v1/images/generations',
    )
  })

  it('normalizeBaseUrl keeps bare origin; buildApiUrl injects /v1 segment', () => {
    // bare origin has empty path segments → normalizeBaseUrl does not force /v1
    expect(normalizeBaseUrl('https://api.you-box.com')).toBe('https://api.you-box.com')
    expect(normalizeBaseUrl('https://api.you-box.com/v1/')).toBe('https://api.you-box.com/v1')
    // absolute base without /v1 still produces correct OpenAI-compat path
    expect(buildApiUrl('https://api.you-box.com', 'images/generations')).toBe(
      'https://api.you-box.com/v1/images/generations',
    )
  })
})
