// BOXAI: one browser-mode OAuth completion policy shared by every provider callback.
import type { AuthResponse, User } from '@/types'
import type { OAuthTokenResponse } from '@/api/auth'
import { adoptLegacySession, bootstrap } from './browserSession'

export type OAuthFinalization = Partial<OAuthTokenResponse> & {
  auth_result?: string
  redirect?: string
}

export interface OAuthAuthStore {
  setAuthFromResponse(response: AuthResponse): void
  setToken(token: string): Promise<User>
}

export async function finalizeBrowserOAuth(
  completion: OAuthFinalization,
  authStore: OAuthAuthStore
): Promise<boolean> {
  if (completion.user && completion.access_token) {
    authStore.setAuthFromResponse(completion as AuthResponse)
    return true
  }
  if (completion.auth_result === 'session') {
    const session = await bootstrap(true)
    if (!session) return false
    authStore.setAuthFromResponse(session)
    return true
  }
  if (completion.refresh_token) {
    const session = await adoptLegacySession(completion.refresh_token)
    if (session) {
      authStore.setAuthFromResponse(session)
      return true
    }
  }
  // Legacy callbacks may only carry an access token. Keep it memory-only for /auth/me.
  if (completion.access_token) {
    await authStore.setToken(completion.access_token)
    return true
  }
  return false
}
