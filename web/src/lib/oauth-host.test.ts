import { describe, expect, it } from 'vitest'
import {
  oauthRedirectCompatibleWithHost,
  parseOAuthLoginFlags,
} from './customer-api'

describe('oauthRedirectCompatibleWithHost', () => {
  it('allows empty and relative redirects (legacy / same-host assumption)', () => {
    expect(oauthRedirectCompatibleWithHost('', 'you-box.com')).toBe(true)
    expect(oauthRedirectCompatibleWithHost(undefined, 'you-box.com')).toBe(true)
    expect(oauthRedirectCompatibleWithHost('/auth/oauth/callback', 'you-box.com')).toBe(true)
  })

  it('requires absolute callback host to match current host', () => {
    expect(
      oauthRedirectCompatibleWithHost(
        'https://console.you-box.com/api/v1/auth/oauth/google/callback',
        'you-box.com',
      ),
    ).toBe(false)
    expect(
      oauthRedirectCompatibleWithHost(
        'https://you-box.com/api/v1/auth/oauth/google/callback',
        'you-box.com',
      ),
    ).toBe(true)
    expect(
      oauthRedirectCompatibleWithHost(
        'https://console.you-box.com/api/v1/auth/oauth/google/callback',
        'console.you-box.com',
      ),
    ).toBe(true)
  })

  it('allows www alias pair', () => {
    expect(
      oauthRedirectCompatibleWithHost('https://www.you-box.com/api/v1/auth/oauth/google/callback', 'you-box.com'),
    ).toBe(true)
  })

  it('rejects garbage URLs', () => {
    expect(oauthRedirectCompatibleWithHost('not a url', 'you-box.com')).toBe(false)
  })
})

describe('parseOAuthLoginFlags host gate', () => {
  it('hides google on apex when redirect points at console', () => {
    const flags = parseOAuthLoginFlags(
      {
        google_oauth_enabled: true,
        google_oauth_redirect_url: 'https://console.you-box.com/api/v1/auth/oauth/google/callback',
        github_oauth_enabled: false,
      },
      { host: 'you-box.com' },
    )
    expect(flags.google).toBe(false)
  })

  it('shows google when redirect host matches apex', () => {
    const flags = parseOAuthLoginFlags(
      {
        google_oauth_enabled: true,
        google_oauth_redirect_url: 'https://you-box.com/api/v1/auth/oauth/google/callback',
      },
      { host: 'you-box.com' },
    )
    expect(flags.google).toBe(true)
  })

  it('hides google on product apex when redirect URL not published (fail-closed)', () => {
    const flags = parseOAuthLoginFlags(
      {
        google_oauth_enabled: true,
      },
      { host: 'you-box.com' },
    )
    expect(flags.google).toBe(false)
  })

  it('shows google on self-host when redirect URL not published (backward compat)', () => {
    const flags = parseOAuthLoginFlags(
      {
        google_oauth_enabled: true,
      },
      { host: 'boxai.example.com' },
    )
    expect(flags.google).toBe(true)
  })
})
