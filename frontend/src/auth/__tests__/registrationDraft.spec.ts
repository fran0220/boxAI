import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('registrationDraft', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.resetModules()
  })

  it('persists only safe opaque transaction metadata and restores it after reload', async () => {
    const first = await import('../registrationDraft')
    first.setRegistrationDraft({
      transaction_id: 'a'.repeat(43),
      email: 'user@example.com',
      countdown: 60,
      redirect: '/dashboard',
      password: 'plaintext-secret',
      turnstile_token: 'challenge-secret',
    })

    const stored = sessionStorage.getItem('boxai_registration_transaction') || ''
    expect(stored).not.toContain('plaintext-secret')
    expect(stored).not.toContain('challenge-secret')

    vi.resetModules()
    const reloaded = await import('../registrationDraft')
    expect(reloaded.getRegistrationDraft()).toEqual({
      transaction_id: 'a'.repeat(43),
      email: 'user@example.com',
      countdown: 60,
      redirect: '/dashboard',
    })
  })

  it('never persists sensitive pending OAuth drafts', async () => {
    const drafts = await import('../registrationDraft')
    drafts.setRegistrationDraft({
      email: 'oauth@example.com',
      password: 'secret',
      pending_auth_token: 'pending-secret',
      pending_provider: 'oidc',
    })
    expect(sessionStorage.getItem('boxai_registration_transaction')).toBeNull()
    expect(drafts.getRegistrationDraft()?.pending_auth_token).toBe('pending-secret')
  })
})
