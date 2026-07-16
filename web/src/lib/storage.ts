const SSO_VERIFIER = 'boxai_sso_verifier'
const SSO_STATE = 'boxai_sso_state'
const SSO_RETURN = 'boxai_sso_return'

export function saveSsoPending(params: { verifier: string; state: string; returnTo?: string }): void {
  sessionStorage.setItem(SSO_VERIFIER, params.verifier)
  sessionStorage.setItem(SSO_STATE, params.state)
  if (params.returnTo) sessionStorage.setItem(SSO_RETURN, params.returnTo)
}

export function getSsoPending(): { verifier: string; state: string; returnTo: string } | null {
  const verifier = sessionStorage.getItem(SSO_VERIFIER) || ''
  const state = sessionStorage.getItem(SSO_STATE) || ''
  const returnTo = sessionStorage.getItem(SSO_RETURN) || '/create'
  if (!verifier) return null
  return { verifier, state, returnTo }
}

export function clearSsoPending(): void {
  sessionStorage.removeItem(SSO_VERIFIER)
  sessionStorage.removeItem(SSO_STATE)
  sessionStorage.removeItem(SSO_RETURN)
}
