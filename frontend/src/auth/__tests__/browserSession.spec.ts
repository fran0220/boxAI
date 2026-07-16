import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import {
  bootstrap,
  bootstrapWithLegacyAdoption,
  clearBrowserSession,
  getAccessToken,
  resetBrowserSessionForTest,
  setBrowserSession
} from '../browserSession'

vi.mock('axios', () => ({ default: { post: vi.fn() } }))
vi.mock('@/api/url', () => ({ getAPIBaseURL: () => '/api' }))

const user = { id: 1, username: 'box', email: 'box@example.com', role: 'user' } as any
const response = (token = 'access', expires = 60) => ({
  access_token: token,
  expires_in: expires,
  token_type: 'Bearer',
  user
})

describe('browserSession', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.mocked(axios.post).mockReset()
    localStorage.clear()
    resetBrowserSessionForTest()
  })

  it('accepts a response in memory and clears it without persistence', () => {
    setBrowserSession(response())
    expect(getAccessToken()).toBe('access')
    expect(localStorage.length).toBe(0)
    clearBrowserSession()
    expect(getAccessToken()).toBeNull()
  })

  it('never returns a known-expired access token', () => {
    vi.useFakeTimers()
    setBrowserSession(response('short', 1))
    vi.setSystemTime(Date.now() + 1_001)
    expect(getAccessToken()).toBeNull()
  })

  it('does not create a zero-delay refresh loop for short sessions', async () => {
    vi.useFakeTimers()
    vi.mocked(axios.post).mockResolvedValue({ data: response('renewed', 10) })
    setBrowserSession(response('short', 1))

    await vi.advanceTimersByTimeAsync(999)
    expect(axios.post).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(axios.post).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(axios.post).toHaveBeenCalledTimes(1)
  })

  it('single-flights cookie bootstrap', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: response() })
    const [first, second] = await Promise.all([bootstrap(true), bootstrap(true)])
    expect(first).toEqual(second)
    expect(axios.post).toHaveBeenCalledTimes(1)
  })

  it('deletes every legacy key even when adoption falls back', async () => {
    localStorage.setItem('refresh_token', 'legacy')
    localStorage.setItem('auth_token', 'old-access')
    vi.mocked(axios.post)
      .mockRejectedValueOnce(new Error('no cookie'))
      .mockResolvedValueOnce({ data: response('adopted') })
    await bootstrapWithLegacyAdoption()
    expect(getAccessToken()).toBe('adopted')
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('does not let an in-flight bootstrap restore a cleared session', async () => {
    let resolveBootstrap!: (value: { data: ReturnType<typeof response> }) => void
    vi.mocked(axios.post).mockImplementationOnce(
      () => new Promise((resolve) => { resolveBootstrap = resolve }),
    )
    const pending = bootstrap(true)

    clearBrowserSession()
    resolveBootstrap({ data: response('stale') })
    await pending

    expect(getAccessToken()).toBeNull()
  })

  it('keeps an authoritative login when an older bootstrap finishes later', async () => {
    let resolveBootstrap!: (value: { data: ReturnType<typeof response> }) => void
    vi.mocked(axios.post).mockImplementationOnce(
      () => new Promise((resolve) => { resolveBootstrap = resolve }),
    )
    const pending = bootstrap(true)

    setBrowserSession(response('current'))
    resolveBootstrap({ data: response('stale') })
    await pending

    expect(getAccessToken()).toBe('current')
  })
})
