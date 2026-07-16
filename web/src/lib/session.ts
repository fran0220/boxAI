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
const logoutListeners = new Set<() => void>()
let snapshot: SessionSnapshot = { status: 'bootstrapping', accessToken: null, user: null }
let bootstrapPromise: Promise<SessionSnapshot> | null = null
let channel: BroadcastChannel | null = null
let expiresAt: number | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let sessionEpoch = 0
let logoutEpoch = 0

type SessionMessage = { type: 'changed' | 'logout' }

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

async function logoutPost(): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/auth/session/logout`, {
    method: 'POST', credentials: 'include', headers: browserHeaders(),
  })
  if (!response.ok) throw new Error(response.statusText || 'Logout failed')
}

function publish(next: SessionSnapshot, broadcast = false): SessionSnapshot {
  snapshot = next
  listeners.forEach((listener) => listener())
  if (broadcast) getChannel()?.postMessage({ type: 'changed' } satisfies SessionMessage)
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

async function migrateAndBootstrap(epoch: number): Promise<SessionSnapshot> {
  const refresh = typeof window === 'undefined' ? null : window.localStorage.getItem('refresh_token')
  if (refresh) {
    try {
      const adopted = await withAdoptionLock(() => sessionPost('/api/v1/auth/session/adopt', { refresh_token: refresh }))
      clearLegacy()
      if (epoch !== sessionEpoch) return snapshot
      return accept(adopted, true)
    } catch {
      // Another tab may have consumed the one-time refresh token. The stable cookie is authoritative.
      if (epoch !== sessionEpoch) return snapshot
    } finally {
      clearLegacy()
    }
  } else {
    clearLegacy()
  }
  try {
    const session = await sessionPost('/api/v1/auth/session', {})
    if (epoch !== sessionEpoch) return snapshot
    return accept(session)
  } catch {
    if (epoch !== sessionEpoch) return snapshot
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
  channel.onmessage = (event: MessageEvent<SessionMessage | string>) => {
    const type = typeof event.data === 'string' ? event.data : event.data?.type
    if (type === 'logout') {
      applyLogout()
      return
    }
    resyncSession()
  }
  return channel
}

function applyLogout(): void {
  sessionEpoch += 1
  clearRefreshTimer()
  expiresAt = null
  logoutEpoch += 1
  logoutListeners.forEach((listener) => listener())
  publish({ status: 'anonymous', accessToken: null, user: null })
  clearLegacy()
}

function resyncSession(): void {
  sessionEpoch += 1
  const epoch = sessionEpoch
  const pending = bootstrapPromise
  const run = () => {
    if (epoch === sessionEpoch) void bootstrapSession(true)
  }
  if (pending) void pending.then(run, run)
  else run()
}

export function getSessionSnapshot(): SessionSnapshot { return snapshot }
export function getLogoutEpoch(): number { return logoutEpoch }
export function getAccessToken(): string | null {
  return expiresAt !== null && Date.now() >= expiresAt ? null : snapshot.accessToken
}
export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener); getChannel()
  return () => listeners.delete(listener)
}
export function subscribeLogout(listener: () => void): () => void {
  logoutListeners.add(listener)
  return () => logoutListeners.delete(listener)
}

export function bootstrapSession(force = false): Promise<SessionSnapshot> {
  if (bootstrapPromise) return bootstrapPromise
  if (force || snapshot.status !== 'bootstrapping') {
    publish({ status: 'bootstrapping', accessToken: snapshot.accessToken, user: snapshot.user })
  }
  const pending = migrateAndBootstrap(sessionEpoch)
  bootstrapPromise = pending
  void pending.finally(() => {
    if (bootstrapPromise === pending) bootstrapPromise = null
  })
  return pending
}

export function setSession(data: SessionData): void {
  sessionEpoch += 1
  accept(data, true)
}
export function markSessionRejected(): void {
  sessionEpoch += 1
  clearRefreshTimer(); expiresAt = null
  publish({ status: snapshot.accessToken ? 'expired' : 'anonymous', accessToken: null, user: null }, true)
}

export async function logoutSession(): Promise<void> {
  sessionEpoch += 1
  try { await logoutPost() } catch { /* local logout still wins */ }
  applyLogout()
  getChannel()?.postMessage({ type: 'logout' } satisfies SessionMessage)
}

export const sessionRequestHeaders = browserHeaders

// Test isolation without exposing mutable credentials to application code.
export function __resetSessionForTests(): void {
  clearRefreshTimer(); expiresAt = null
  snapshot = { status: 'bootstrapping', accessToken: null, user: null }; bootstrapPromise = null
  sessionEpoch = 0; logoutEpoch = 0
  channel?.close(); channel = null; listeners.clear(); logoutListeners.clear()
}
