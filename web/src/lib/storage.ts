const AUTH_TOKEN = 'auth_token'
const REFRESH_TOKEN = 'refresh_token'
const TOKEN_EXPIRES_AT = 'token_expires_at'
const AUTH_USER = 'auth_user'
const SSO_VERIFIER = 'boxai_sso_verifier'
const SSO_STATE = 'boxai_sso_state'
const SSO_RETURN = 'boxai_sso_return'

export interface AuthUser {
  id: number
  email?: string
  username?: string
  role?: string
  [key: string]: unknown
}

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN)
}

export function getTokenExpiresAt(): number | null {
  const v = localStorage.getItem(TOKEN_EXPIRES_AT)
  return v ? parseInt(v, 10) : null
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_USER)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken() && !!getUser()
}

export function setSession(params: {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  user?: AuthUser
}): void {
  localStorage.setItem(AUTH_TOKEN, params.accessToken)
  if (params.refreshToken) localStorage.setItem(REFRESH_TOKEN, params.refreshToken)
  if (params.expiresIn) {
    localStorage.setItem(TOKEN_EXPIRES_AT, String(Date.now() + params.expiresIn * 1000))
  }
  if (params.user) localStorage.setItem(AUTH_USER, JSON.stringify(params.user))
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_TOKEN)
  localStorage.removeItem(REFRESH_TOKEN)
  localStorage.removeItem(TOKEN_EXPIRES_AT)
  localStorage.removeItem(AUTH_USER)
}

export function saveSsoPending(params: { verifier: string; state: string; returnTo?: string }): void {
  sessionStorage.setItem(SSO_VERIFIER, params.verifier)
  sessionStorage.setItem(SSO_STATE, params.state)
  if (params.returnTo) sessionStorage.setItem(SSO_RETURN, params.returnTo)
}

export function takeSsoPending(): { verifier: string; state: string; returnTo: string } | null {
  const verifier = sessionStorage.getItem(SSO_VERIFIER) || ''
  const state = sessionStorage.getItem(SSO_STATE) || ''
  const returnTo = sessionStorage.getItem(SSO_RETURN) || '/create'
  sessionStorage.removeItem(SSO_VERIFIER)
  sessionStorage.removeItem(SSO_STATE)
  sessionStorage.removeItem(SSO_RETURN)
  if (!verifier) return null
  return { verifier, state, returnTo }
}
