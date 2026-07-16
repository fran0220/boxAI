import { beforeEach, describe, expect, it, vi } from 'vitest'
import { finalizeBrowserOAuth } from '../finalizeOAuth'

const { bootstrap, adoptLegacySession } = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  adoptLegacySession: vi.fn()
}))

vi.mock('../browserSession', () => ({ bootstrap, adoptLegacySession }))

const user = { id: 1, username: 'user' } as any
const session = { access_token: 'session-token', expires_in: 60, user } as any

describe('finalizeBrowserOAuth', () => {
  const authStore = { setAuthFromResponse: vi.fn(), setToken: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    authStore.setToken.mockResolvedValue(user)
  })

  it('sets a browser response containing a user directly', async () => {
    const response = { access_token: 'token', user }
    await expect(finalizeBrowserOAuth(response, authStore)).resolves.toBe(true)
    expect(authStore.setAuthFromResponse).toHaveBeenCalledWith(response)
  })

  it('bootstraps an auth_result=session response and sets it', async () => {
    bootstrap.mockResolvedValue(session)
    await expect(finalizeBrowserOAuth({ auth_result: 'session' }, authStore)).resolves.toBe(true)
    expect(bootstrap).toHaveBeenCalledWith(true)
    expect(authStore.setAuthFromResponse).toHaveBeenCalledWith(session)
  })

  it('adopts a legacy refresh credential and sets the resulting session', async () => {
    adoptLegacySession.mockResolvedValue(session)
    await expect(finalizeBrowserOAuth({ refresh_token: 'legacy' }, authStore)).resolves.toBe(true)
    expect(adoptLegacySession).toHaveBeenCalledWith('legacy')
    expect(authStore.setAuthFromResponse).toHaveBeenCalledWith(session)
  })

  it('keeps an access-only legacy result in memory through setToken', async () => {
    await expect(finalizeBrowserOAuth({ access_token: 'legacy-access' }, authStore)).resolves.toBe(true)
    expect(authStore.setToken).toHaveBeenCalledWith('legacy-access')
  })

  it('returns false when no credential is present', async () => {
    await expect(finalizeBrowserOAuth({}, authStore)).resolves.toBe(false)
    expect(authStore.setAuthFromResponse).not.toHaveBeenCalled()
    expect(authStore.setToken).not.toHaveBeenCalled()
  })
})
