import { apiBase } from './brand'
import {
  bootstrapSession,
  getAccessToken,
  logoutSession,
  markSessionRejected,
  sessionRequestHeaders,
  type AuthUser,
} from './session'

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

function authHeaders(token?: string | null): Record<string, string> {
  const headers = sessionRequestHeaders()
  const t = token ?? getAccessToken()
  if (t) headers.Authorization = `Bearer ${t}`
  return headers
}

async function apiRequest<T>(path: string, init: RequestInit, token?: string | null, retry = true): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...authHeaders(token), ...init.headers },
  })
  if (res.status === 401 && retry && !path.startsWith('/api/v1/auth/')) {
    const refreshed = await bootstrapSession(true)
    if (refreshed.status === 'authenticated') return apiRequest<T>(path, init, refreshed.accessToken, false)
    markSessionRejected()
  }
  return parseEnvelope<T>(res)
}

export async function apiPost<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, token)
}

export async function apiGet<T>(path: string, token?: string | null): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' }, token)
}

export async function apiPut<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
  return apiRequest<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, token)
}

export async function apiDelete<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
  return apiRequest<T>(path, {
    method: 'DELETE',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, token)
}

/** Build `/api/v1/...` path with optional query string. */
export function withQuery(path: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return path
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    qs.set(key, String(value))
  }
  const s = qs.toString()
  return s ? `${path}?${s}` : path
}

/**
 * Browser session auth responses (password login, registration, SSO exchange).
 * When X-BoxAI-Browser-Session is set, backend mints a host cookie + short JWT.
 */
export interface AuthResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  user: AuthUser
  auth_result?: string
  requires_2fa?: boolean
  temp_token?: string
  user_email_masked?: string
}

export async function fetchMe(): Promise<AuthUser> {
  return apiGet<AuthUser>('/api/v1/auth/me')
}

export async function logout(): Promise<void> {
  await logoutSession()
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
  return gatewayRequest(path, init, token, true)
}

async function gatewayRequest(path: string, init: RequestInit, token: string, retry: boolean): Promise<Response> {
  const headers = new Headers(init.headers)
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  Object.entries(sessionRequestHeaders()).forEach(([key, value]) => {
    headers.set(key, value)
  })
  const response = await fetch(`${apiBase()}${path}`, { ...init, credentials: 'include', headers })
  if (response.status === 401 && retry) {
    const refreshed = await bootstrapSession(true)
    if (refreshed.accessToken) return gatewayRequest(path, init, refreshed.accessToken, false)
    markSessionRejected()
  }
  return response
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

/** Remix/edit: multipart to the OpenAI-compatible images/edits endpoint. */
export async function imageEdits(params: {
  model: string
  prompt: string
  image: Blob
  n?: number
  size?: string
}): Promise<unknown> {
  const form = new FormData()
  form.set('model', params.model)
  form.set('prompt', params.prompt)
  form.set('image', params.image, 'reference.png')
  if (params.n) form.set('n', String(params.n))
  if (params.size) form.set('size', params.size)
  const res = await gatewayFetch('/v1/images/edits', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(text || 'Image edit failed', res.status)
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

export interface GatewayModel {
  id: string
  owned_by?: string
}

export async function fetchModels(): Promise<GatewayModel[]> {
  const res = await gatewayFetch('/v1/models', { method: 'GET' })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(text || 'Model list failed', res.status)
  }
  const body = (await res.json()) as { data?: GatewayModel[] }
  return (body.data || []).filter((m) => typeof m.id === 'string' && m.id.length > 0)
}
