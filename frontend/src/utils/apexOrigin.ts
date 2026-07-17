/**
 * BOXAI: marketing / customer shell origin (you-box.com).
 * Used to send ordinary users off console customer routes after shell unification.
 */
export function apexOrigin(): string {
  const fromEnv = (import.meta.env.VITE_APEX_ORIGIN as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'console.you-box.com') return 'https://you-box.com'
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5173'
  }
  return 'https://you-box.com'
}

/**
 * When true, non-admin navigations to customer paths hard-redirect to apex.
 * Default on for production console host; opt-out with VITE_CUSTOMER_SHELL_REDIRECT=0.
 */
export function customerShellRedirectEnabled(): boolean {
  const flag = (import.meta.env.VITE_CUSTOMER_SHELL_REDIRECT as string | undefined)?.trim()
  if (flag === '0' || flag === 'false') return false
  if (flag === '1' || flag === 'true') return true
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'console.you-box.com'
  }
  return false
}

/**
 * Console paths that remain valid without redirecting to apex.
 * Auth forms stay for admin login; WeChat MP payment still needs console host
 * (external callback domain) so /purchase + /payment/* stay for non-admins.
 */
const CONSOLE_PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/email-verify',
  '/forgot-password',
  '/reset-password',
  '/auth/',
  '/legal/',
  '/setup',
  '/key-usage',
  '/download/desktop',
]

/** WeChat MP / legacy payment completion on console host only. */
const CONSOLE_PAYMENT_EXCEPTION_PREFIXES = [
  '/purchase',
  '/payment/',
]

/** Console customer paths → apex React routes. */
export const APEX_CUSTOMER_PATH_MAP: Record<string, string> = {
  '/': '/account',
  '/home': '/',
  '/dashboard': '/account',
  '/keys': '/account/keys',
  '/usage': '/account/usage',
  '/profile': '/account/profile',
  '/subscriptions': '/account/subscription',
  '/orders': '/account/orders',
  '/redeem': '/account/redeem',
  '/affiliate': '/account/affiliate',
  '/available-channels': '/account/channels',
  '/monitor': '/account/monitor',
  '/batch-image': '/account/batch-image',
  '/desktop-auth': '/desktop-auth',
}

export function isConsolePublicPath(path: string): boolean {
  if (CONSOLE_PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) return true
  if (CONSOLE_PAYMENT_EXCEPTION_PREFIXES.some((p) => path === p || path.startsWith(p))) return true
  return false
}

export function isConsoleAdminPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/')
}

export function mapConsolePathToApex(path: string, search = ''): string | null {
  // Payment stays on console for WeChat MP / Elements fallback — do not map.
  if (path === '/purchase' || path.startsWith('/payment/')) return null
  const exact = APEX_CUSTOMER_PATH_MAP[path]
  if (exact) return `${apexOrigin()}${exact}${search}`
  if (path.startsWith('/custom/')) return `${apexOrigin()}/account${search}`
  return null
}

export function apexUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${apexOrigin()}${p}`
}
