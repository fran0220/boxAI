import { apiBase } from './brand'
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  setSession,
  type AuthUser,
} from './storage'

export class ApiError extends Error {
  status: number
  code?: number
  constructor(message: string, status: number, code?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface Envelope<T> {
  code: number
  message: string
  data?: T
}

async function parseEnvelope<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as Envelope<T> | null
  if (!res.ok || !body || body.code !== 0) {
    throw new ApiError(body?.message || res.statusText || 'Request failed', res.status, body?.code)
  }
  return body.data as T
}

function authHeaders(token?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  const t = token ?? getAccessToken()
  if (t) headers.Authorization = `Bearer ${t}`
  return headers
}

export async function apiPost<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return parseEnvelope<T>(res)
}

export async function apiGet<T>(path: string, token?: string | null): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'GET',
    headers: authHeaders(token),
  })
  return parseEnvelope<T>(res)
}

export interface AuthResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  user: AuthUser
  requires_2fa?: boolean
  temp_token?: string
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>('/api/v1/auth/login', { email, password })
  if (data.requires_2fa) return data
  setSession({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    user: data.user,
  })
  return data
}

export async function login2fa(tempToken: string, code: string): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>('/api/v1/auth/login/2fa', {
    temp_token: tempToken,
    totp_code: code,
  })
  setSession({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    user: data.user,
  })
  return data
}

export async function register(params: {
  email: string
  password: string
  username?: string
}): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>('/api/v1/auth/register', params)
  setSession({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    user: data.user,
  })
  return data
}

export async function fetchMe(): Promise<AuthUser> {
  return apiGet<AuthUser>('/api/v1/auth/me')
}

export async function logout(): Promise<void> {
  try {
    const refresh = getRefreshToken()
    await apiPost('/api/v1/auth/logout', refresh ? { refresh_token: refresh } : {})
  } catch {
    // ignore network errors on logout
  }
  clearSession()
}

export async function authorizeSso(params: {
  codeChallenge: string
  redirectUri: string
}): Promise<{ code: string; expires_in: number }> {
  return apiPost('/api/v1/auth/boxai/sso/authorize', {
    code_challenge: params.codeChallenge,
    redirect_uri: params.redirectUri,
  })
}

export async function exchangeSsoToken(params: {
  code: string
  codeVerifier: string
  redirectUri?: string
}): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>('/api/v1/auth/boxai/sso/token', {
    code: params.code,
    code_verifier: params.codeVerifier,
    redirect_uri: params.redirectUri,
  })
  setSession({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    user: data.user,
  })
  return data
}

export async function ensureCreatorKey(): Promise<{
  id: number
  name: string
  created: boolean
  group_id?: number | null
  status?: string
}> {
  return apiPost('/api/v1/boxai/creator/ensure-key', {})
}

/** Gateway helpers — JWT via DesktopJWTGatewayAuth bridge */
export async function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  if (!token) throw new ApiError('Not authenticated', 401)
  const headers = new Headers(init.headers)
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(`${apiBase()}${path}`, { ...init, headers })
}

export async function chatCompletions(
  body: unknown,
  init?: { signal?: AbortSignal },
): Promise<Response> {
  return gatewayFetch('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify(body),
    signal: init?.signal,
  })
}

export async function imageGenerations(body: unknown): Promise<unknown> {
  const res = await gatewayFetch('/v1/images/generations', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(text || 'Image generation failed', res.status)
  }
  return res.json()
}

export async function videoGenerations(body: unknown): Promise<unknown> {
  const res = await gatewayFetch('/v1/videos/generations', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(text || 'Video generation failed', res.status)
  }
  return res.json()
}

export async function videoStatus(id: string): Promise<unknown> {
  const res = await gatewayFetch(`/v1/videos/${encodeURIComponent(id)}`, { method: 'GET' })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(text || 'Video status failed', res.status)
  }
  return res.json()
}
