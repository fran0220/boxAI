import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

// Mock authAPI
const mockLogin = vi.fn()
const mockLogin2FA = vi.fn()
const mockLogout = vi.fn()
const mockGetCurrentUser = vi.fn()
const mockRegister = vi.fn()
const mockRefreshToken = vi.fn()
const setBrowserSession = vi.fn()
const bootstrapWithLegacyAdoption = vi.fn()
let memoryToken: string | null = null

vi.mock('@/auth/browserSession', () => ({
  setBrowserSession: (...args: any[]) => { memoryToken = args[0].access_token; return setBrowserSession(...args) },
  bootstrapWithLegacyAdoption: (...args: any[]) => bootstrapWithLegacyAdoption(...args),
  getAccessToken: () => memoryToken,
  installLegacyAccessToken: (token: string) => { memoryToken = token },
  clearBrowserSession: () => { memoryToken = null },
  logoutBrowserSession: async () => { memoryToken = null },
  subscribeBrowserSession: () => () => {}
}))

vi.mock('@/api', () => ({
  authAPI: {
    login: (...args: any[]) => mockLogin(...args),
    login2FA: (...args: any[]) => mockLogin2FA(...args),
    logout: (...args: any[]) => mockLogout(...args),
    getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
    register: (...args: any[]) => mockRegister(...args),
    refreshToken: (...args: any[]) => mockRefreshToken(...args),
  },
  isTotp2FARequired: (response: any) => response?.requires_2fa === true,
}))

const fakeUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'user' as const,
  balance: 100,
  concurrency: 5,
  status: 'active' as const,
  allowed_groups: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
}

const fakeAdminUser = {
  ...fakeUser,
  id: 2,
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin' as const,
}

const fakeAuthResponse = {
  access_token: 'test-token-123',
  refresh_token: 'refresh-token-456',
  expires_in: 3600,
  token_type: 'Bearer',
  user: { ...fakeUser },
}

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.useFakeTimers()
    vi.clearAllMocks()
    memoryToken = null
    bootstrapWithLegacyAdoption.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // --- login ---

  describe('login', () => {
    it('成功登录后设置 token 和 user', async () => {
      mockLogin.mockResolvedValue(fakeAuthResponse)
      const store = useAuthStore()
      // Exercise the production order: route guards evaluate this while anonymous.
      expect(store.isAuthenticated).toBe(false)

      await store.login({ email: 'test@example.com', password: '123456' })

      expect(store.token).toBe('test-token-123')
      expect(store.user).toEqual(fakeUser)
      expect(store.isAuthenticated).toBe(true)
      expect(setBrowserSession).toHaveBeenCalledWith(fakeAuthResponse)
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('auth_user')).toBeNull()
    })

    it('登录失败时清除状态并抛出错误', async () => {
      mockLogin.mockRejectedValue(new Error('Invalid credentials'))
      const store = useAuthStore()

      await expect(store.login({ email: 'test@example.com', password: 'wrong' })).rejects.toThrow(
        'Invalid credentials'
      )

      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
      expect(store.isAuthenticated).toBe(false)
    })

    it('需要 2FA 时返回响应但不设置认证状态', async () => {
      const twoFAResponse = { requires_2fa: true, temp_token: 'temp-123' }
      mockLogin.mockResolvedValue(twoFAResponse)
      const store = useAuthStore()

      const result = await store.login({ email: 'test@example.com', password: '123456' })

      expect(result).toEqual(twoFAResponse)
      expect(store.token).toBeNull()
      expect(store.isAuthenticated).toBe(false)
    })
  })

  // --- login2FA ---

  describe('login2FA', () => {
    it('2FA 验证成功后设置认证状态', async () => {
      mockLogin2FA.mockResolvedValue(fakeAuthResponse)
      const store = useAuthStore()

      const user = await store.login2FA('temp-123', '654321')

      expect(store.token).toBe('test-token-123')
      expect(store.user).toEqual(fakeUser)
      expect(user).toEqual(fakeUser)
      expect(mockLogin2FA).toHaveBeenCalledWith({
        temp_token: 'temp-123',
        totp_code: '654321',
      })
    })

    it('2FA 验证失败时清除状态并抛出错误', async () => {
      mockLogin2FA.mockRejectedValue(new Error('Invalid TOTP'))
      const store = useAuthStore()

      await expect(store.login2FA('temp-123', '000000')).rejects.toThrow('Invalid TOTP')
      expect(store.token).toBeNull()
      expect(store.isAuthenticated).toBe(false)
    })
  })

  // --- logout ---

  describe('logout', () => {
    it('注销后清除所有状态和 localStorage', async () => {
      mockLogin.mockResolvedValue(fakeAuthResponse)
      mockLogout.mockResolvedValue(undefined)
      const store = useAuthStore()

      // 先登录
      await store.login({ email: 'test@example.com', password: '123456' })
      expect(store.isAuthenticated).toBe(true)

      // 注销
      await store.logout()

      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
      expect(store.isAuthenticated).toBe(false)
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('auth_user')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
      expect(localStorage.getItem('token_expires_at')).toBeNull()
    })
  })

  // --- checkAuth ---

  describe('checkAuth', () => {
    it('从浏览器 cookie 会话恢复内存状态', async () => {
      bootstrapWithLegacyAdoption.mockResolvedValue(fakeAuthResponse)
      const store = useAuthStore()
      await store.checkAuth()

      expect(bootstrapWithLegacyAdoption).toHaveBeenCalledTimes(1)
      expect(store.token).toBe('test-token-123')
      expect(store.user).toEqual(fakeUser)
      expect(store.isAuthenticated).toBe(true)
    })

    it('localStorage 无数据时保持未认证状态', () => {
      const store = useAuthStore()
      store.checkAuth()

      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
      expect(store.isAuthenticated).toBe(false)
    })

    it('清除旧版持久化 pending auth credential 而不恢复', async () => {
      localStorage.setItem(
        'pending_auth_session',
        JSON.stringify({
          token: 'pending-token',
          token_field: 'pending_auth_token',
          provider: 'wechat',
          redirect: '/profile',
        })
      )

      const store = useAuthStore()
      await store.checkAuth()

      expect(store.hasPendingAuthSession).toBe(false)
      expect(store.pendingAuthSession).toBeNull()
      expect(localStorage.getItem('pending_auth_session')).toBeNull()
    })
  })

  describe('pending auth session', () => {
    it('keeps pending auth session memory-only and clears legacy storage', () => {
      const store = useAuthStore()

      store.setPendingAuthSession({
        token: 'pending-token',
        token_field: 'pending_auth_token',
        provider: 'wechat',
        redirect: '/profile',
      })

      expect(store.hasPendingAuthSession).toBe(true)
      expect(store.pendingAuthSession?.token).toBe('pending-token')
      expect(localStorage.getItem('pending_auth_session')).toBeNull()

      store.clearPendingAuthSession()

      expect(store.hasPendingAuthSession).toBe(false)
      expect(localStorage.getItem('pending_auth_session')).toBeNull()
    })

    it('does not restore a pending oauth session after a new store is created', async () => {
      const firstStore = useAuthStore()

      firstStore.setPendingAuthSession({
        token: '',
        token_field: 'pending_oauth_token',
        provider: 'oidc',
        redirect: '/welcome',
        adoption_required: true,
        suggested_display_name: 'OIDC Nick'
      })

      setActivePinia(createPinia())
      const restoredStore = useAuthStore()
      await restoredStore.checkAuth()

      expect(restoredStore.isAuthenticated).toBe(false)
      expect(restoredStore.hasPendingAuthSession).toBe(false)
      expect(restoredStore.pendingAuthSession).toBeNull()
    })

    it('preserves pending auth session when registration fails', async () => {
      const store = useAuthStore()
      store.setPendingAuthSession({
        token: 'pending-token',
        token_field: 'pending_auth_token',
        provider: 'oidc',
        redirect: '/register',
      })
      mockRegister.mockRejectedValue(new Error('Register failed'))

      await expect(
        store.register({ email: 'user@example.com', password: 'secret-123' })
      ).rejects.toThrow('Register failed')

      expect(store.hasPendingAuthSession).toBe(true)
      expect(store.pendingAuthSession).toEqual({
        token: 'pending-token',
        token_field: 'pending_auth_token',
        provider: 'oidc',
        redirect: '/register',
      })
    })
  })

  // --- isAdmin ---

  describe('isAdmin', () => {
    it('管理员用户返回 true', async () => {
      const adminResponse = { ...fakeAuthResponse, user: { ...fakeAdminUser } }
      mockLogin.mockResolvedValue(adminResponse)
      const store = useAuthStore()

      await store.login({ email: 'admin@example.com', password: '123456' })

      expect(store.isAdmin).toBe(true)
    })

    it('普通用户返回 false', async () => {
      mockLogin.mockResolvedValue(fakeAuthResponse)
      const store = useAuthStore()

      await store.login({ email: 'test@example.com', password: '123456' })

      expect(store.isAdmin).toBe(false)
    })

    it('未登录时返回 false', () => {
      const store = useAuthStore()
      expect(store.isAdmin).toBe(false)
    })
  })

  // --- refreshUser ---

  describe('refreshUser', () => {
    it('刷新用户数据并仅更新内存用户', async () => {
      mockLogin.mockResolvedValue(fakeAuthResponse)
      const store = useAuthStore()
      await store.login({ email: 'test@example.com', password: '123456' })

      const updatedUser = { ...fakeUser, username: 'updated-name' }
      mockGetCurrentUser.mockResolvedValue({ data: updatedUser })

      const result = await store.refreshUser()

      expect(result).toEqual(updatedUser)
      expect(store.user).toEqual(updatedUser)
      expect(localStorage.getItem('auth_user')).toBeNull()
    })

    it('未认证时抛出错误', async () => {
      const store = useAuthStore()
      await expect(store.refreshUser()).rejects.toThrow('Not authenticated')
    })
  })

  // --- isSimpleMode ---

  describe('isSimpleMode', () => {
    it('run_mode 为 simple 时返回 true', async () => {
      const simpleResponse = {
        ...fakeAuthResponse,
        user: { ...fakeUser, run_mode: 'simple' as const },
      }
      mockLogin.mockResolvedValue(simpleResponse)
      const store = useAuthStore()

      await store.login({ email: 'test@example.com', password: '123456' })

      expect(store.isSimpleMode).toBe(true)
    })

    it('默认为 standard 模式', () => {
      const store = useAuthStore()
      expect(store.isSimpleMode).toBe(false)
    })
  })
})
