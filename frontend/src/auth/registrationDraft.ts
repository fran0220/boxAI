import type { RegisterRequest } from '@/types'

// BOXAI: Sensitive OAuth drafts remain memory-only; only opaque transaction
// metadata is recoverable after a refresh.
export interface RegistrationDraft extends Partial<RegisterRequest> {
  email: string
  transaction_id?: string
  countdown?: number
  redirect?: string
  pending_auth_token?: string
  pending_auth_token_field?: 'pending_auth_token' | 'pending_oauth_token'
  pending_provider?: string
  pending_redirect?: string
  pending_adoption_decision?: { adopt_display_name?: boolean; adopt_avatar?: boolean }
}

let draft: RegistrationDraft | null = null
const storageKey = 'boxai_registration_transaction'

function safeStoredDraft(value: RegistrationDraft): RegistrationDraft | null {
  if (typeof value.transaction_id !== 'string' || !/^[A-Za-z0-9_-]{40,128}$/.test(value.transaction_id)) return null
  if (typeof value.email !== 'string' || value.email.length > 320 || !value.email.includes('@')) return null
  if (value.redirect !== undefined && (typeof value.redirect !== 'string' || !value.redirect.startsWith('/') || value.redirect.startsWith('//'))) return null
  if (value.countdown !== undefined && (!Number.isInteger(value.countdown) || value.countdown < 0 || value.countdown > 900)) return null
  return {
    transaction_id: value.transaction_id,
    email: value.email,
    ...(value.redirect ? { redirect: value.redirect } : {}),
    ...(value.countdown !== undefined ? { countdown: value.countdown } : {}),
  }
}

export const setRegistrationDraft = (value: RegistrationDraft): void => {
  draft = value
  const safe = safeStoredDraft(value)
  if (safe) sessionStorage.setItem(storageKey, JSON.stringify(safe))
  else sessionStorage.removeItem(storageKey)
}
export const getRegistrationDraft = (): RegistrationDraft | null => {
  if (draft) return draft
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as RegistrationDraft | null
    const safe = parsed ? safeStoredDraft(parsed) : null
    if (!safe) sessionStorage.removeItem(storageKey)
    return safe
  } catch {
    sessionStorage.removeItem(storageKey)
    return null
  }
}
export const clearRegistrationDraft = (): void => {
  draft = null
  sessionStorage.removeItem(storageKey)
}
