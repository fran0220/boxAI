/**
 * Apex OAuth pending exchange helpers (LinuxDo / WeChat / OIDC / DingTalk).
 *
 * Existing-user login and Profile bind complete via HttpOnly pending cookies +
 * POST /api/v1/auth/oauth/pending/exchange (often with an empty URL fragment).
 * Full chooser / invitation / TOTP UI stays parked on Vue.
 */

import { apiBase } from './brand'
import {
  bootstrapSession,
  sessionRequestHeaders,
  setSession,
  type AuthUser,
} from './session'
import { safeReturnPath } from './safe-return'

export type PendingOAuthExchangeResult = {
  access_token?: string
  expires_in?: number
  token_type?: string
  user?: AuthUser
  auth_result?: string
  redirect?: string
  error?: string
  requires_2fa?: boolean
  temp_token?: string
  user_email_masked?: string
  adoption_required?: boolean
  suggested_display_name?: string
  suggested_avatar_url?: string
  step?: string
  create_account_allowed?: boolean
  existing_account_bindable?: boolean
  email_binding_required?: boolean
  force_email_on_signup?: boolean
}

export type OAuthFragment = {
  authResult: string
  redirect: string
  error: string
  errorDescription: string
}

export type OAuthCompleteOutcome =
  | { kind: 'authenticated'; redirect: string }
  | { kind: 'parked'; reason: string }
  | { kind: 'error'; message: string }

interface Envelope<T> {
  code: number
  message: string
  data?: T
}

/** Decline suggested display name / avatar and finish bind/login (Vue second exchange). */
export const DECLINE_ADOPTION_BODY = {
  adopt_display_name: false,
  adopt_avatar: false,
} as const

/** Map console legacy redirects onto apex customer routes. */
export function mapLegacyOAuthRedirect(path: string): string {
  if (path === '/dashboard' || path.startsWith('/dashboard?') || path.startsWith('/dashboard#')) {
    return '/account' + path.slice('/dashboard'.length)
  }
  if (path === '/' || path === '/home') return '/account'
  return path
}

export function parseOAuthFragment(hash: string): OAuthFragment {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  return {
    authResult: params.get('auth_result') || '',
    redirect: params.get('redirect') || '',
    error: params.get('error') || '',
    errorDescription:
      params.get('error_description') || params.get('message') || params.get('error_message') || '',
  }
}

function hasHardMultiStepBlocker(completion: PendingOAuthExchangeResult): boolean {
  if (completion.error === 'invitation_required') return true
  if (completion.requires_2fa === true || (completion.temp_token && completion.temp_token.trim())) return true
  if (completion.email_binding_required === true || completion.force_email_on_signup === true) return true
  if (completion.create_account_allowed === true && !completion.access_token) return true
  if (completion.existing_account_bindable === true && !completion.access_token) return true
  const step = (completion.step || '').trim().toLowerCase()
  if (step && step !== 'done' && step !== 'completed' && step !== 'success') return true
  return false
}

/**
 * Silent completion (existing-user login or bind) vs parked multi-step UI.
 * Mirrors Vue LinuxDoCallbackView happy path without rendering chooser forms.
 */
export function isSilentOAuthCompletion(completion: PendingOAuthExchangeResult): boolean {
  if (completion.adoption_required === true) return false
  if (completion.auth_result === 'pending_session') return false
  if (hasHardMultiStepBlocker(completion)) return false
  // Generic error without tokens → not silent login
  if (completion.error && !(completion.access_token && completion.access_token.trim())) return false
  return true
}

/**
 * Preview payload that only waits on profile adoption confirmation
 * (typical bind with suggested_display_name / suggested_avatar_url).
 * Safe to auto-finalize by declining adoption — not invitation/TOTP/chooser.
 */
export function isAdoptionOnlyPreview(completion: PendingOAuthExchangeResult): boolean {
  if (completion.adoption_required !== true) return false
  if (hasHardMultiStepBlocker(completion)) return false
  // auth_result=pending_session without a step is still adoption-only for bind previews
  return true
}

export function resolveOAuthRedirect(
  preferred: string | null | undefined,
  fallback = '/account',
): string {
  return mapLegacyOAuthRedirect(safeReturnPath(preferred, fallback))
}

/**
 * Best-effort pending cookie cleanup. Pending cookies are HttpOnly on
 * Path=/api/v1/auth/oauth — JS cannot clear them. Server clears on successful
 * exchange, failed GetBrowserSession, and OAuth start (session cookie).
 * Documented 10-minute TTL remains the backstop for parked multi-step state.
 */
export function notePendingOAuthCookieLifecycle(): void {
  // No-op placeholder for call sites / tests that assert cleanup was considered.
}

export async function exchangePendingOAuthCompletion(
  body: Record<string, unknown> = {},
): Promise<PendingOAuthExchangeResult> {
  const response = await fetch(`${apiBase()}/api/v1/auth/oauth/pending/exchange`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...sessionRequestHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  const envelope = (await response.json().catch(() => null)) as Envelope<PendingOAuthExchangeResult> | null
  if (!response.ok || !envelope || envelope.code !== 0 || !envelope.data) {
    throw new Error(envelope?.message || response.statusText || 'Pending OAuth exchange failed')
  }
  return envelope.data
}

async function finalizeSilentCompletion(
  completion: PendingOAuthExchangeResult,
  fragment: OAuthFragment,
  fallback: string,
): Promise<OAuthCompleteOutcome> {
  const dest = resolveOAuthRedirect(completion.redirect || fragment.redirect, fallback)

  if (completion.access_token && completion.user) {
    setSession({
      access_token: completion.access_token,
      expires_in: completion.expires_in,
      token_type: completion.token_type,
      user: completion.user,
    })
    return { kind: 'authenticated', redirect: dest }
  }

  if (completion.access_token) {
    setSession({
      access_token: completion.access_token,
      expires_in: completion.expires_in,
      token_type: completion.token_type,
      user: completion.user || { id: 0 },
    })
    try {
      await bootstrapSession(true)
    } catch {
      /* setSession already applied token */
    }
    return { kind: 'authenticated', redirect: dest }
  }

  // Bind (or re-login) completion without new token: host session should already exist.
  const session = await bootstrapSession(true)
  if (session.status !== 'authenticated') {
    if (completion.redirect) {
      return { kind: 'authenticated', redirect: dest }
    }
    return { kind: 'error', message: 'session_bootstrap_failed' }
  }
  return { kind: 'authenticated', redirect: dest }
}

/**
 * Complete apex OAuth after provider redirect.
 * - `#auth_result=session` → bootstrap host cookie session
 * - empty / non-session fragment → pending exchange (LinuxDo/WeChat/OIDC/DingTalk)
 * - adoption_required only → second exchange declining profile adoption (bind + login)
 * - multi-step payloads → parked (no chooser UI on apex)
 */
export async function completeOAuthFromCallback(
  fragment: OAuthFragment,
  options?: { defaultRedirect?: string },
): Promise<OAuthCompleteOutcome> {
  const fallback = options?.defaultRedirect || '/account'

  if (fragment.error) {
    notePendingOAuthCookieLifecycle()
    return {
      kind: 'error',
      // Provider fragment errors keep descriptive text for the UI.
      message: fragment.errorDescription || fragment.error,
    }
  }

  if (fragment.authResult === 'session') {
    try {
      const session = await bootstrapSession(true)
      if (session.status !== 'authenticated') {
        return { kind: 'error', message: 'session_bootstrap_failed' }
      }
      return {
        kind: 'authenticated',
        redirect: resolveOAuthRedirect(fragment.redirect, fallback),
      }
    } catch {
      return { kind: 'error', message: 'session_bootstrap_failed' }
    }
  }

  // Empty fragment (or unknown) → pending cookie exchange (primary LinuxDo/WeChat path).
  try {
    let completion = await exchangePendingOAuthCompletion({})

    // Bind / first-link previews set adoption_required without consuming the session.
    // Decline suggested profile fields and finalize (matches Vue second exchange).
    if (isAdoptionOnlyPreview(completion)) {
      completion = await exchangePendingOAuthCompletion({ ...DECLINE_ADOPTION_BODY })
    }

    if (!isSilentOAuthCompletion(completion)) {
      notePendingOAuthCookieLifecycle()
      return {
        kind: 'parked',
        reason: completion.error || completion.step || completion.auth_result || 'pending_unsupported',
      }
    }

    return finalizeSilentCompletion(completion, fragment, fallback)
  } catch {
    notePendingOAuthCookieLifecycle()
    // Always use a sentinel so the SPA can map to i18n (never raw backend English).
    return {
      kind: 'error',
      message: 'exchange_failed',
    }
  }
}

// —— StrictMode / remount guard ——
// Pending exchange is one-shot. Dev StrictMode double-mounts effects; share one
// promise for the page visit so the second mount reuses the first result.

let oauthCallbackInflight: Promise<OAuthCompleteOutcome> | null = null

/**
 * Run OAuth callback completion once per page visit (shared across remounts).
 * Call only after parsing the fragment; hash strip is the caller's job.
 */
export function runOAuthCallbackOnce(
  fragment: OAuthFragment,
  options?: { defaultRedirect?: string },
): Promise<OAuthCompleteOutcome> {
  if (!oauthCallbackInflight) {
    oauthCallbackInflight = completeOAuthFromCallback(fragment, options)
  }
  return oauthCallbackInflight
}

/** Test isolation for module-level inflight promise. */
export function __resetOAuthCallbackInflightForTests(): void {
  oauthCallbackInflight = null
}
