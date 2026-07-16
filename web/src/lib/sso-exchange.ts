import { clearSsoPending, getSsoPending } from './storage'
import { safeReturnPath } from './safe-return'

export interface SsoCallbackInput { code: string; state: string }
export interface SsoExchangeResult { returnTo: string }

let scrubbedInput: SsoCallbackInput | null = null
const exchanges = new Map<string, Promise<SsoExchangeResult>>()

/** Capture fragment credentials once and scrub them synchronously, before any network await. */
export function captureSsoCallback(): SsoCallbackInput {
  if (scrubbedInput) return scrubbedInput
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  scrubbedInput = { code: hash.get('code') || query.get('code') || '', state: hash.get('state') || query.get('state') || '' }
  window.history.replaceState(null, '', window.location.pathname)
  return scrubbedInput
}

export function exchangeSsoOnce(
  input: SsoCallbackInput,
  exchange: (params: { code: string; codeVerifier: string; redirectUri: string }) => Promise<unknown>,
): Promise<SsoExchangeResult> {
  const existing = exchanges.get(input.code)
  if (existing) return existing
  const promise = (async () => {
    const pending = getSsoPending()
    if (!input.code) throw new Error('missing-code')
    if (!pending?.verifier) throw new Error('missing-verifier')
    if (!pending.state || !input.state || pending.state !== input.state) {
      clearSsoPending()
      throw new Error('state-mismatch')
    }
    try {
      await exchange({ code: input.code, codeVerifier: pending.verifier, redirectUri: `${window.location.origin}/sso/callback` })
      return { returnTo: safeReturnPath(pending.returnTo, '/create') }
    } finally {
      clearSsoPending()
    }
  })()
  exchanges.set(input.code, promise)
  return promise
}

export function __resetSsoExchangeForTests(): void { scrubbedInput = null; exchanges.clear() }
