import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetOAuthCallbackInflightForTests,
  completeOAuthFromCallback,
  isAdoptionOnlyPreview,
  isSilentOAuthCompletion,
  mapLegacyOAuthRedirect,
  parseOAuthFragment,
  resolveOAuthRedirect,
  runOAuthCallbackOnce,
  type PendingOAuthExchangeResult,
} from './oauth-pending'
import { __resetSessionForTests, getSessionSnapshot } from './session'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify({ code: 0, message: '', data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('oauth-pending helpers', () => {
  beforeAll(() => {
    if (!window.localStorage) {
      const values = new Map<string, string>()
      const storage = {
        get length() {
          return values.size
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => [...values.keys()][index] ?? null,
        removeItem: (key: string) => {
          values.delete(key)
        },
        setItem: (key: string, value: string) => {
          values.set(key, String(value))
        },
      } satisfies Storage
      Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
    }
  })
  beforeEach(() => {
    __resetSessionForTests()
    __resetOAuthCallbackInflightForTests()
    window.localStorage.clear()
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses session and error fragments', () => {
    expect(parseOAuthFragment('#auth_result=session&redirect=%2Faccount%2Fkeys')).toEqual({
      authResult: 'session',
      redirect: '/account/keys',
      error: '',
      errorDescription: '',
    })
    expect(parseOAuthFragment('#error=provider_error&error_description=nope')).toMatchObject({
      error: 'provider_error',
      errorDescription: 'nope',
    })
  })

  it('maps legacy console redirects', () => {
    expect(mapLegacyOAuthRedirect('/dashboard')).toBe('/account')
    expect(mapLegacyOAuthRedirect('/dashboard?tab=1')).toBe('/account?tab=1')
    expect(resolveOAuthRedirect('/dashboard', '/account')).toBe('/account')
    expect(resolveOAuthRedirect('//evil.com', '/account')).toBe('/account')
  })

  it('classifies silent existing-user completion vs parked multi-step', () => {
    expect(
      isSilentOAuthCompletion({
        auth_result: 'session',
        access_token: 'tok',
        user: { id: 1 },
        redirect: '/account',
      }),
    ).toBe(true)

    expect(
      isSilentOAuthCompletion({
        redirect: '/account/profile',
      }),
    ).toBe(true)

    // Bare payload is not silent — avoid empty-success classification.
    expect(isSilentOAuthCompletion({})).toBe(false)

    expect(
      isSilentOAuthCompletion({
        error: 'invitation_required',
      }),
    ).toBe(false)

    expect(
      isSilentOAuthCompletion({
        requires_2fa: true,
        temp_token: 'tmp',
      }),
    ).toBe(false)

    expect(
      isSilentOAuthCompletion({
        auth_result: 'pending_session',
        step: 'choose_account_action_required',
      }),
    ).toBe(false)

    expect(
      isSilentOAuthCompletion({
        adoption_required: true,
        suggested_display_name: 'Alice',
      }),
    ).toBe(false)

    expect(
      isSilentOAuthCompletion({
        step: 'bind_login_required',
      } as PendingOAuthExchangeResult),
    ).toBe(false)
  })

  it('detects adoption-only preview vs true multi-step', () => {
    expect(
      isAdoptionOnlyPreview({
        adoption_required: true,
        suggested_display_name: 'Alice',
        redirect: '/account/profile',
      }),
    ).toBe(true)

    expect(
      isAdoptionOnlyPreview({
        adoption_required: true,
        error: 'invitation_required',
      }),
    ).toBe(false)

    expect(
      isAdoptionOnlyPreview({
        adoption_required: true,
        step: 'choose_account_action_required',
      }),
    ).toBe(false)

    expect(
      isAdoptionOnlyPreview({
        adoption_required: true,
        requires_2fa: true,
        temp_token: 'x',
      }),
    ).toBe(false)

    expect(isAdoptionOnlyPreview({ redirect: '/account' })).toBe(false)
  })

  it('empty fragment + pending exchange success authenticates without auth_result fragment', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        auth_result: 'session',
        access_token: 'apex-access',
        expires_in: 900,
        user: { id: 9, email: 'u@example.com' },
        redirect: '/account/keys',
      }),
    )

    const outcome = await completeOAuthFromCallback({
      authResult: '',
      redirect: '',
      error: '',
      errorDescription: '',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/auth/oauth/pending/exchange')
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.credentials).toBe('include')
    expect(init.headers).toMatchObject({
      'X-BoxAI-Browser-Session': '1',
      'X-BoxAI-CSRF': '1',
    })
    expect(outcome).toEqual({ kind: 'authenticated', redirect: '/account/keys' })
    expect(getSessionSnapshot()).toMatchObject({
      status: 'authenticated',
      accessToken: 'apex-access',
    })
  })

  it('adoption_required-only preview auto re-exchanges with decline decision (bind)', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          adoption_required: true,
          suggested_display_name: 'X',
          suggested_avatar_url: 'https://cdn.example/a.png',
          redirect: '/account/profile',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          redirect: '/account/profile',
        }),
      )
      // bootstrap after bind (no access_token)
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'existing-host',
          expires_in: 900,
          user: { id: 4, email: 'bound@example.com' },
        }),
      )

    const outcome = await completeOAuthFromCallback({
      authResult: '',
      redirect: '/account/profile',
      error: '',
      errorDescription: '',
    })

    expect(fetchMock).toHaveBeenCalled()
    const exchangeCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/v1/auth/oauth/pending/exchange'),
    )
    expect(exchangeCalls).toHaveLength(2)
    expect(JSON.parse(String((exchangeCalls[0]?.[1] as RequestInit).body))).toEqual({})
    expect(JSON.parse(String((exchangeCalls[1]?.[1] as RequestInit).body))).toEqual({
      adopt_display_name: false,
      adopt_avatar: false,
    })
    expect(outcome).toEqual({ kind: 'authenticated', redirect: '/account/profile' })
  })

  it('empty fragment + multi-step exchange parks without hanging', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        error: 'invitation_required',
        step: 'choose_account_action_required',
        auth_result: 'pending_session',
      }),
    )

    const outcome = await completeOAuthFromCallback({
      authResult: '',
      redirect: '',
      error: '',
      errorDescription: '',
    })

    expect(outcome.kind).toBe('parked')
    expect(getSessionSnapshot().status).not.toBe('authenticated')
  })

  it('auth_result=session fragment bootstraps without exchange', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        access_token: 'from-cookie',
        expires_in: 900,
        user: { id: 3, email: 's@example.com' },
      }),
    )

    const outcome = await completeOAuthFromCallback({
      authResult: 'session',
      redirect: '/account',
      error: '',
      errorDescription: '',
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/auth/session')
    expect(outcome).toEqual({ kind: 'authenticated', redirect: '/account' })
  })

  it('provider error fragment fails closed with descriptive message', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const outcome = await completeOAuthFromCallback({
      authResult: '',
      redirect: '',
      error: 'provider_error',
      errorDescription: 'access_denied',
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(outcome).toEqual({ kind: 'error', message: 'access_denied' })
  })

  it('exchange failure returns exchange_failed sentinel (not raw English)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 40001, message: 'Pending auth session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const outcome = await completeOAuthFromCallback({
      authResult: '',
      redirect: '',
      error: '',
      errorDescription: '',
    })

    expect(outcome).toEqual({ kind: 'error', message: 'exchange_failed' })
  })

  it('redirect-only exchange without host session is error (not false authenticated)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    // pending exchange returns redirect only (bind path after token scrub)
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        redirect: '/account/profile',
      }),
    )
    // bootstrap session → unauthenticated
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 40100, message: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const outcome = await completeOAuthFromCallback({
      authResult: '',
      redirect: '',
      error: '',
      errorDescription: '',
    })

    expect(outcome).toEqual({ kind: 'error', message: 'session_bootstrap_failed' })
    expect(getSessionSnapshot().status).not.toBe('authenticated')
  })

  it('runOAuthCallbackOnce shares one promise across remounts', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        auth_result: 'session',
        access_token: 'once',
        expires_in: 900,
        user: { id: 1 },
        redirect: '/account',
      }),
    )

    const frag = { authResult: '', redirect: '', error: '', errorDescription: '' }
    const a = runOAuthCallbackOnce(frag)
    const b = runOAuthCallbackOnce(frag)
    expect(a).toBe(b)
    const [oa, ob] = await Promise.all([a, b])
    expect(oa).toEqual(ob)
    expect(oa).toEqual({ kind: 'authenticated', redirect: '/account' })
    // Single exchange despite two callers
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
