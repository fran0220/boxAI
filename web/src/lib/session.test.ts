import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetSessionForTests, bootstrapSession, getAccessToken, getSessionSnapshot, setSession } from './session'
import { apiGet, imageEdits } from './api'

const user = { id: 7, email: 'test@you-box.com' }
const envelope = (token: string) => new Response(JSON.stringify({ code: 0, message: '', data: { access_token: token, user } }), { status: 200 })

describe('browser session', () => {
  beforeAll(() => {
    if (!window.localStorage) {
      const values = new Map<string, string>()
      const storage = {
        get length() { return values.size },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => [...values.keys()][index] ?? null,
        removeItem: (key: string) => { values.delete(key) },
        setItem: (key: string, value: string) => { values.set(key, String(value)) },
      } satisfies Storage
      Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
    }
  })
  beforeEach(() => {
    __resetSessionForTests()
    window.localStorage.clear()
    vi.restoreAllMocks()
  })
  afterEach(() => vi.useRealTimers())

  it('adopts a legacy refresh token once and always clears all legacy credentials', async () => {
    window.localStorage.setItem('refresh_token', 'legacy-refresh')
    window.localStorage.setItem('auth_token', 'legacy-access')
    window.localStorage.setItem('auth_user', '{}')
    window.localStorage.setItem('token_expires_at', '123')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(envelope('memory-only'))

    await bootstrapSession()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/auth/session/adopt')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' })
    expect(getSessionSnapshot()).toMatchObject({ status: 'authenticated', accessToken: 'memory-only' })
    expect(window.localStorage.length).toBe(0)
  })

  it('falls back to cookie bootstrap when one-time adoption loses a race', async () => {
    window.localStorage.setItem('refresh_token', 'already-consumed')
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(envelope('cookie-token'))
    await bootstrapSession()
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(['/api/v1/auth/session/adopt', '/api/v1/auth/session'])
    expect(window.localStorage.getItem('refresh_token')).toBeNull()
  })

  it('keeps new credentials in memory and retries a non-auth 401 exactly once', async () => {
    setSession({ access_token: 'old', user })
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 1, message: 'expired' }), { status: 401 }))
      .mockResolvedValueOnce(envelope('fresh'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, message: '', data: { ok: true } }), { status: 200 }))

    await expect(apiGet<{ ok: boolean }>('/api/v1/example')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(window.localStorage.getItem('auth_token')).toBeNull()
    expect(getSessionSnapshot().accessToken).toBe('fresh')
  })

  it('auto-bootstraps before expiry and becomes anonymous when refresh fails', async () => {
    vi.useFakeTimers()
    setSession({ access_token: 'short-lived', expires_in: 4, user })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }))

    await vi.advanceTimersByTimeAsync(2_000)
    expect(getSessionSnapshot().status).toBe('anonymous')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    setSession({ access_token: 'expired', expires_in: 0, user })
    expect(getAccessToken()).toBeNull()
  })

  it('shares an in-flight bootstrap but starts a new request after it settles', async () => {
    let resolveFirst!: (response: Response) => void
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce(envelope('second'))
    const first = bootstrapSession()
    expect(bootstrapSession()).toBe(first)
    resolveFirst(envelope('first'))
    await first
    await bootstrapSession()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps multipart browser security headers without forcing JSON content type', async () => {
    setSession({ access_token: 'token', user })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    await imageEdits({ model: 'gpt-image-2', prompt: 'edit', image: new Blob(['x']) })
    const init = fetchMock.mock.calls[0]?.[1]
    const headers = new Headers(init?.headers)
    expect(init?.credentials).toBe('include')
    expect(headers.get('X-BoxAI-CSRF')).toBe('1')
    expect(headers.has('Content-Type')).toBe(false)
  })
})
