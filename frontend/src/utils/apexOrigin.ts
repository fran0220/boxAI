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
 * When true, non-admin navigations to migrated customer paths hard-redirect to apex.
 * Default on in production host; opt-out with VITE_CUSTOMER_SHELL_REDIRECT=0.
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

/** Console customer paths that now live on the apex React shell. */
export const APEX_CUSTOMER_PATH_MAP: Record<string, string> = {
  '/dashboard': '/account',
  '/keys': '/account/keys',
  '/usage': '/account/usage',
  '/profile': '/account/profile',
  '/subscriptions': '/account/subscription',
  '/purchase': '/checkout',
  '/orders': '/account/orders',
  '/redeem': '/account/redeem',
  '/affiliate': '/account/affiliate',
  '/desktop-auth': '/desktop-auth',
}

export function mapConsolePathToApex(path: string, search = ''): string | null {
  const exact = APEX_CUSTOMER_PATH_MAP[path]
  if (exact) return `${apexOrigin()}${exact}${search}`
  // payment sub-routes → apex result/checkout
  if (path === '/payment/result') return `${apexOrigin()}/payment/result${search}`
  if (path.startsWith('/payment/')) return `${apexOrigin()}/checkout${search}`
  return null
}
