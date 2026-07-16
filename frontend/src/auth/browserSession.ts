// BOXAI: Browser authentication is cookie-backed. This framework-free module is the
// single owner of the short-lived access token so Axios, streams and sockets can share it.
import axios from 'axios'
import type { AuthResponse } from '@/types'
import { getAPIBaseURL } from '@/api/url'

export type BrowserSession = AuthResponse
type Listener = (session: BrowserSession | null) => void

const LEGACY_KEYS = ['auth_token', 'refresh_token', 'auth_user', 'token_expires_at'] as const
const headers = { 'X-BoxAI-Browser-Session': '1', 'X-BoxAI-CSRF': '1' }
let current: BrowserSession | null = null
let legacyAccessToken: string | null = null
let expiresAt: number | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let bootstrapFlight: Promise<BrowserSession | null> | null = null
const listeners = new Set<Listener>()
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('boxai-browser-session') : null

function unwrap(value: unknown): BrowserSession {
  const body = value as { code?: number; data?: BrowserSession }
  return (body?.data || value) as BrowserSession
}

function publish(session: BrowserSession | null, broadcast = true): void {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = null
  current = session
  legacyAccessToken = null
  expiresAt = session?.expires_in ? Date.now() + session.expires_in * 1000 : null
  if (session && expiresAt) {
    const ttl = expiresAt - Date.now()
    // Refresh 30s early in production. Tiny test/dev TTLs refresh halfway
    // through, with a floor that prevents a zero-delay request loop.
    const delay = ttl > 30_000 ? ttl - 30_000 : Math.max(1_000, ttl / 2)
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      void bootstrap(true, false)
    }, delay)
  }
  listeners.forEach((listener) => listener(session))
  if (broadcast) channel?.postMessage(session ? 'changed' : 'logout')
}

channel?.addEventListener('message', (event) => {
  if (event.data === 'logout') publish(null, false)
  else if (event.data === 'changed') void bootstrap(true, false)
})

export function getAccessToken(): string | null {
  if (expiresAt !== null && Date.now() >= expiresAt) return null
  return current?.access_token || legacyAccessToken
}

// BOXAI: final migration fallback for callbacks that lack a browser-session response.
export function installLegacyAccessToken(token: string): void {
  legacyAccessToken = token
  current = null
  expiresAt = null
}

export function setBrowserSession(session: BrowserSession): void {
  publish(session)
}

export function clearBrowserSession(): void {
  publish(null)
}

export function subscribeBrowserSession(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

async function request(path: string, body?: unknown): Promise<BrowserSession> {
  const response = await axios.post(`${getAPIBaseURL()}${path}`, body, {
    withCredentials: true,
    timeout: 30000,
    headers
  })
  return unwrap(response.data)
}

export function bootstrap(force = false, broadcastSuccess = true): Promise<BrowserSession | null> {
  if (bootstrapFlight) return bootstrapFlight
  if (!force && current) return Promise.resolve(current)
  bootstrapFlight = request('/auth/session')
    .then((session) => { publish(session, broadcastSuccess); return session })
    // BOXAI: cookie discovery failure is local state, not an explicit cross-tab logout.
    .catch(() => { publish(null, false); return null })
    .finally(() => { bootstrapFlight = null })
  return bootstrapFlight
}

export async function adoptLegacySession(refreshToken: string): Promise<BrowserSession | null> {
  try {
    const session = await request('/auth/session/adopt', { refresh_token: refreshToken })
    publish(session)
    return session
  } catch {
    // Another tab may have consumed the one-time token and already created the cookie.
    return bootstrap(true)
  }
}

export async function bootstrapWithLegacyAdoption(): Promise<BrowserSession | null> {
  const legacyRefresh = localStorage.getItem('refresh_token')
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key))
  const run = async () => {
    // Another tab may already have exchanged the one-time credential.
    const shared = await bootstrap(true)
    return shared || (legacyRefresh ? adoptLegacySession(legacyRefresh) : null)
  }
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  return locks ? locks.request('boxai-browser-session-adoption', run) : run()
}

export async function logoutBrowserSession(): Promise<void> {
  try { await request('/auth/session/logout') } finally {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key))
    publish(null)
  }
}

/** Test-only state reset; deliberately does not broadcast or make requests. */
export function resetBrowserSessionForTest(): void {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = null
  current = null
  legacyAccessToken = null
  expiresAt = null
  bootstrapFlight = null
  listeners.clear()
}
