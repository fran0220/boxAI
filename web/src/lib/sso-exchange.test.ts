import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveSsoPending } from './storage'
import { __resetSsoExchangeForTests, captureSsoCallback, exchangeSsoOnce } from './sso-exchange'

describe('SSO callback replay', () => {
  beforeEach(() => { sessionStorage.clear(); __resetSsoExchangeForTests() })

  it('scrubs fragment immediately and exchanges each code only once across replayed effects', async () => {
    history.replaceState(null, '', '/sso/callback#code=one-time&state=expected')
    saveSsoPending({ verifier: 'verifier', state: 'expected', returnTo: '/create/image' })
    const input = captureSsoCallback()
    expect(location.hash).toBe('')
    const exchange = vi.fn(async () => undefined)
    const first = exchangeSsoOnce(input, exchange)
    const replay = exchangeSsoOnce(captureSsoCallback(), exchange)
    await expect(Promise.all([first, replay])).resolves.toEqual([
      { returnTo: '/create/image' }, { returnTo: '/create/image' },
    ])
    expect(exchange).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('boxai_sso_verifier')).toBeNull()
  })
})
