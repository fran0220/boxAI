import { apiBase } from './brand'

export interface AuthUser {
  id: number
  email?: string
  username?: string
  role?: string
  [key: string]: unknown
}

export type SessionStatus = 'bootstrapping' | 'anonymous' | 'authenticated' | 'expired'
export interface SessionSnapshot { status: SessionStatus; accessToken: string | null; user: AuthUser | null }
interface SessionData { access_token: string; expires_in?: number; token_type?: string; user: AuthUser }
interface Envelope<T> { code: number; message: string; data?: T }

const LEGACY_KEYS = ['auth_token', 'refresh_token', 'auth_user', 'token_expires_at'] as const
const listeners = new Set<() => void>()
let snapshot: SessionSnapshot = { status: 'bootstrapping', accessToken: null, user: null }
let bootstrapPromise: Promise<SessionSnapshot> | null = null
let channel: BroadcastChannel | null = null
let expiresAt: number | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

function clearRefreshTimer(): void {
  if (refreshTimer !== null) clearTimeout(refreshTimer)
  refreshTimer = null
}

function browserHeaders(): Record<string, string> {
  return { Accept: 'application/json', 'X-BoxAI-Browser-Session': '1', 'X-BoxAI-CSRF': '1' }
}

async function sessionPost(path: string, body: unknown): Promise<SessionData> {
  const response = await fetch(`${apiBase()}${path}`, {
    method: 'POST', credentials: 'include', headers: { ...browserHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const envelope = await response.json().catch(() => null) as Envelope<SessionData> | null
  if (!response.ok || !envelope || envelope.code !== 0 || !envelope.data?.access_token) {
    throw new Error(envelope?.message || response.statusText || 'Session request failed')
  }
  return envelope.data
}

function publish(next: SessionSnapshot, broadcast = false): SessionSnapshot {
  snapshot = next
  listeners.forEach((listener) => listener())
  if (broadcast) getChannel()?.postMessage('session-changed')
  return snapshot
}

function accept(data: SessionData, broadcast = false): SessionSnapshot {
  clearRefreshTimer()
  expiresAt = typeof data.expires_in === 'number' ? Date.now() + Math.max(0, data.expires_in) * 1000 : null
  if (expiresAt !== null) {
    const ttl = expiresAt - Date.now()
    // Refresh 30s early when possible. Tiny test/dev TTLs refresh halfway through,
    // with a floor so they cannot create a zero-delay request loop.
    const delay = ttl > 30_000 ? ttl - 30_000 : Math.max(1_000, ttl / 2)
    refreshTimer = setTimeout(() => { void bootstrapSession(true) }, delay)
  }
  return publish({ status: 'authenticated', accessToken: data.access_token, user: data.user }, broadcast)
}

function clearLegacy(): void {
  if (typeof window === 'undefined') return
  LEGACY_KEYS.forEach((key) => window.localStorage.removeItem(key))
}

async function migrateAndBootstrap(): Promise<SessionSnapshot> {
  const refresh = typeof window === 'undefined' ? null : window.localStorage.getItem('refresh_token')
  if (refresh) {
    try {
      const adopted = await withAdoptionLock(() => sessionPost('/api/v1/auth/session/adopt', { refresh_token: refresh }))
      clearLegacy()
      return accept(adopted, true)
    } catch {
      // Another tab may have consumed the one-time refresh token. The stable cookie is authoritative.
    } finally {
      clearLegacy()
    }
  } else {
    clearLegacy()
  }
  try {
    return accept(await sessionPost('/api/v1/auth/session', {}))
  } catch {
    return publish({ status: 'anonymous', accessToken: null, user: null })
  }
}

async function withAdoptionLock<T>(work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (locks) return locks.request('boxai-session-adopt', work)
  return work()
}

function getChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel
  channel = new BroadcastChannel('boxai-session')
  channel.onmessage = () => { void bootstrapSession(true) }
  return channel
}

export function getSessionSnapshot(): SessionSnapshot { return snapshot }
export function getAccessToken(): string | null {
  return expiresAt !== null && Date.now() >= expiresAt ? null : snapshot.accessToken
}
export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener); getChannel()
  return () => listeners.delete(listener)
}

export function bootstrapSession(force = false): Promise<SessionSnapshot> {
  if (bootstrapPromise) return bootstrapPromise
  if (force || snapshot.status !== 'bootstrapping') publish({ ...snapshot, status: 'bootstrapping' })
  const pending = migrateAndBootstrap()
  bootstrapPromise = pending
  void pending.finally(() => {
    if (bootstrapPromise === pending) bootstrapPromise = null
  })
  return pending
}

export function setSession(data: SessionData): void { accept(data, true) }
export function markSessionRejected(): void {
  clearRefreshTimer(); expiresAt = null
  publish({ status: snapshot.accessToken ? 'expired' : 'anonymous', accessToken: null, user: null }, true)
}

export async function logoutSession(): Promise<void> {
  try { await sessionPost('/api/v1/auth/session/logout', {}) } catch { /* local logout still wins */ }
  clearRefreshTimer(); expiresAt = null
  publish({ status: 'anonymous', accessToken: null, user: null }, true)
  clearLegacy()
}

export const sessionRequestHeaders = browserHeaders

// Test isolation without exposing mutable credentials to application code.
export function __resetSessionForTests(): void {
  clearRefreshTimer(); expiresAt = null
  snapshot = { status: 'bootstrapping', accessToken: null, user: null }; bootstrapPromise = null
  channel?.close(); channel = null; listeners.clear()
}
