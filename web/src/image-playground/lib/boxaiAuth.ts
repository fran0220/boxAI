/**
 * BoxAI embed adapter for gpt_image_playground.
 *
 * - Session JWT is read at call time (never persisted as apiKey).
 * - Authorization is only attached when the request targets the BoxAI gateway origin.
 * - Multi-provider / custom base URLs must not receive the JWT.
 */

import { apiBase } from '@/lib/brand'
import { getAccessToken, sessionRequestHeaders } from '@/lib/session'

/** Marker profile id used for the locked BoxAI gateway profile. */
export const BOXAI_PROFILE_ID = 'boxai-gateway'
export const BOXAI_PROFILE_NAME = 'BoxAI Gateway'
export const BOXAI_EMBEDDED = true

/** Default image model when gateway list is empty or not yet loaded. */
export const BOXAI_DEFAULT_IMAGE_MODEL = 'gpt-image-2'
export const BOXAI_DEFAULT_RESPONSES_MODEL = 'gpt-5.4'

/**
 * OpenAI-compatible base URL ending with /v1 when an absolute API base is set;
 * empty string means same-origin `/v1/...` (dev proxy + apex nginx).
 */
export function getBoxaiGatewayBaseUrl(): string {
  const base = apiBase().replace(/\/+$/, '')
  if (!base) return ''
  // apiBase is origin only (e.g. https://api.you-box.com) or full host without /v1
  if (base.endsWith('/v1')) return base
  return `${base}/v1`
}

export function getBoxaiSessionToken(): string {
  return getAccessToken()?.trim() || ''
}

export function hasBoxaiSession(): boolean {
  return Boolean(getBoxaiSessionToken())
}

/** True when `url` targets the BoxAI API gateway (same-origin or apiBase origin). */
export function isBoxaiGatewayUrl(url: string): boolean {
  try {
    const resolved = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    const configured = apiBase().replace(/\/+$/, '')
    if (!configured) {
      // Same-origin gateway (nginx / vite proxy)
      if (typeof window === 'undefined') return true
      return resolved.origin === window.location.origin
    }
    const gatewayOrigin = new URL(configured).origin
    return resolved.origin === gatewayOrigin
  } catch {
    return false
  }
}

/**
 * Build Authorization headers for a request URL.
 * Only injects the session JWT for BoxAI gateway requests.
 */
export function createBoxaiRequestHeaders(url: string, extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra }
  if (!isBoxaiGatewayUrl(url)) {
    // Never attach BoxAI browser-session credentials to third-party hosts.
    delete headers.Authorization
    delete headers['X-BoxAI-Browser-Session']
    delete headers['X-BoxAI-CSRF']
    return headers
  }
  Object.assign(headers, sessionRequestHeaders(), extra)
  const token = getBoxaiSessionToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

/**
 * Resolve Authorization for a profile + built request URL.
 * Prefers live session token over any stored profile.apiKey for gateway URLs.
 */
export function resolveAuthHeaders(profileApiKey: string, requestUrl: string): Record<string, string> {
  if (isBoxaiGatewayUrl(requestUrl)) {
    const token = getBoxaiSessionToken()
    if (token) return { ...sessionRequestHeaders(), Authorization: `Bearer ${token}` }
    // Fall through only if no session — empty key will fail with 401
  }
  if (profileApiKey.trim()) {
    return { Authorization: `Bearer ${profileApiKey.trim()}` }
  }
  return {}
}
