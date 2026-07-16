/**
 * Authentication Store
 * Manages user authentication state, login/logout, token refresh, and token persistence
 */

import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import { authAPI, isTotp2FARequired, type LoginResponse } from '@/api'
import type { User, LoginRequest, RegisterRequest, AuthResponse } from '@/types'
import {
  bootstrapWithLegacyAdoption,
  clearBrowserSession,
  getAccessToken,
  installLegacyAccessToken,
  logoutBrowserSession,
  setBrowserSession,
  subscribeBrowserSession
} from '@/auth/browserSession'

const LEGACY_PENDING_AUTH_SESSION_KEY = 'pending_auth_session'

type PendingAuthTokenField = 'pending_auth_token' | 'pending_oauth_token'

interface PendingAuthSessionSummary {
  token: string
  token_field: PendingAuthTokenField
  provider: string
  redirect?: string
  adoption_required?: boolean
  suggested_display_name?: string
  suggested_avatar_url?: string
}

function clearPendingAuthSessionStorage(): void {
  // BOXAI: rollout cleanup for pending OAuth credentials persisted by older clients.
  localStorage.removeItem(LEGACY_PENDING_AUTH_SESSION_KEY)
}

export const useAuthStore = defineStore('auth', () => {
  // ==================== State ====================

  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const runMode = ref<'standard' | 'simple'>('standard')
  const pendingAuthSession = ref<PendingAuthSessionSummary | null>(null)

  // ==================== Computed ====================

  const isAuthenticated = computed(() => {
    // BOXAI: read reactive state before the framework-free session accessor.
    // Otherwise the initial anonymous evaluation short-circuits without a
    // Pinia dependency and remains cached after a successful login.
    return !!token.value && !!user.value && !!getAccessToken()
  })

  const isAdmin = computed(() => {
    return user.value?.role === 'admin'
  })

  const isSimpleMode = computed(() => runMode.value === 'simple')
  const hasPendingAuthSession = computed(() => pendingAuthSession.value !== null)

  // ==================== Actions ====================

  /**
   * Initialize auth state from the host-only browser cookie
   * Call this on app startup to restore session
   * Also starts auto-refresh and immediately fetches latest user data
   */
  async function checkAuth(): Promise<void> {
    // BOXAI: pending OAuth exchange tokens are intentionally memory-only. A
    // reload restarts the provider flow instead of restoring an XSS-readable credential.
    clearPendingAuthSessionStorage()
    const session = await bootstrapWithLegacyAdoption()
    if (session) setAuthFromResponse(session)
    else clearAuth({ preservePendingAuthSession: true })
  }

  /**
   * User login
   * @param credentials - Login credentials (email and password)
   * @returns Promise resolving to the login response (may require 2FA)
   * @throws Error if login fails
   */
  async function login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await authAPI.login(credentials)

      // If 2FA is required, return the response without setting auth state
      if (isTotp2FARequired(response)) {
        return response
      }

      // Set auth state from the response
      setAuthFromResponse(response)

      return response
    } catch (error) {
      // Clear any partial state on error
      clearAuth({ preservePendingAuthSession: pendingAuthSession.value !== null })
      throw error
    }
  }

  /**
   * Complete login with 2FA code
   * @param tempToken - Temporary token from initial login
   * @param totpCode - 6-digit TOTP code
   * @returns Promise resolving to the authenticated user
   * @throws Error if 2FA verification fails
   */
  async function login2FA(tempToken: string, totpCode: string): Promise<User> {
    try {
      const response = await authAPI.login2FA({ temp_token: tempToken, totp_code: totpCode })
      setAuthFromResponse(response)
      return user.value!
    } catch (error) {
      clearAuth({ preservePendingAuthSession: pendingAuthSession.value !== null })
      throw error
    }
  }

  /**
   * Set auth state from an AuthResponse
   * Internal helper function
   */
  function setAuthFromResponse(response: AuthResponse): void {
    // BOXAI: token and user are memory-only; refresh is held in the HttpOnly cookie.
    setBrowserSession(response)
    token.value = response.access_token

    // Extract run_mode if present
    if (response.user.run_mode) {
      runMode.value = response.user.run_mode
    }
    const { run_mode: _run_mode, ...userData } = response.user
    user.value = userData

    clearPendingAuthSession()
  }

  /**
   * User registration
   * @param userData - Registration data (username, email, password)
   * @returns Promise resolving to the newly registered and authenticated user
   * @throws Error if registration fails
   */
  async function register(userData: RegisterRequest): Promise<User> {
    try {
      const response = await authAPI.register(userData)

      // Use the common helper to set auth state
      setAuthFromResponse(response)

      return user.value!
    } catch (error) {
      // Clear any partial state on error
      clearAuth({ preservePendingAuthSession: pendingAuthSession.value !== null })
      throw error
    }
  }

  // BOXAI: complete an opaque email registration and apply the normal browser-session response.
  async function completeRegistration(transactionId: string, verifyCode: string): Promise<User> {
    const response = await authAPI.completeRegistration({ transaction_id: transactionId, verify_code: verifyCode })
    setAuthFromResponse(response)
    return user.value!
  }

  /**
   * 直接设置 token（用于 OAuth/SSO 回调），并加载当前用户信息。
   * 会自动读取 localStorage 中已设置的 refresh_token 和 token_expires_in
   * @param newToken - 后端签发的 JWT access token
   */
  async function setToken(newToken: string): Promise<User> {
    // Clear any previous state first (avoid mixing sessions)
    // Note: Don't clear localStorage here as OAuth callback may have set refresh_token
    token.value = null
    user.value = null
    installLegacyAccessToken(newToken)
    token.value = newToken

    try {
      const userData = await refreshUser()
      clearPendingAuthSession()
      return userData
    } catch (error) {
      clearAuth({ preservePendingAuthSession: pendingAuthSession.value !== null })
      throw error
    }
  }

  function setPendingAuthSession(session: PendingAuthSessionSummary | null): void {
    pendingAuthSession.value = session
    clearPendingAuthSessionStorage()
  }

  function clearPendingAuthSession(): void {
    setPendingAuthSession(null)
  }

  /**
   * User logout
   * Clears all authentication state and persisted data
   */
  async function logout(): Promise<void> {
    try {
      // Call API logout (revokes refresh token on server)
      await logoutBrowserSession()
    } catch (err) {
      // 服务端吊销失败（网络/5xx/超时）不应阻止本地登出，否则用户点了退出仍处于登录态。
      console.warn('Logout API call failed, clearing local session anyway', err)
    } finally {
      // Always clear local state (tokens, user data, refresh timers)
      clearAuth()
    }
  }

  /**
   * Refresh current user data
   * Fetches latest user info from the server
   * @returns Promise resolving to the updated user
   * @throws Error if not authenticated or request fails
   */
  async function refreshUser(): Promise<User> {
    if (!token.value) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await authAPI.getCurrentUser()
      if (response.data.run_mode) {
        runMode.value = response.data.run_mode
      }
      const { run_mode: _run_mode, ...userData } = response.data
      user.value = userData

      return userData
    } catch (error) {
      // If refresh fails with 401, clear auth state
      if ((error as { status?: number }).status === 401) {
        clearAuth({ preservePendingAuthSession: pendingAuthSession.value !== null })
      }
      throw error
    }
  }

  /**
   * Clear all authentication state
   * Internal helper function
   */
  function clearAuth(options?: { preservePendingAuthSession?: boolean }): void {
    token.value = null
    user.value = null
    clearBrowserSession()

    if (options?.preservePendingAuthSession) {
      return
    }

    pendingAuthSession.value = null
    clearPendingAuthSessionStorage()
  }

  // BOXAI: bootstrap/retry/cross-tab changes update Pinia without importing Pinia in session code.
  subscribeBrowserSession((session) => {
    if (session) {
      token.value = session.access_token
      const { run_mode, ...sessionUser } = session.user
      if (run_mode) runMode.value = run_mode
      user.value = sessionUser
    } else {
      token.value = null
      user.value = null
    }
  })

  // ==================== Return Store API ====================

  return {
    // State
    user,
    token,
    runMode: readonly(runMode),
    pendingAuthSession: readonly(pendingAuthSession),

    // Computed
    isAuthenticated,
    isAdmin,
    isSimpleMode,
    hasPendingAuthSession,

    // Actions
    login,
    login2FA,
    register,
    completeRegistration,
    setToken,
    logout,
    checkAuth,
    refreshUser,
    setPendingAuthSession,
    clearPendingAuthSession,
    // BOXAI: used by Web SSO callback to apply token pair without re-login.
    setAuthFromResponse
  }
})
