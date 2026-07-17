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
 * Local: set VITE_CUSTOMER_SHELL_REDIRECT=1 to exercise redirects.
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

/** Console paths that remain valid for everyone (auth bridge, legal, setup). */
const CONSOLE_PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/email-verify',
  '/forgot-password',
  '/reset-password',
  '/auth/',
  '/boxai/sso/',
  '/legal/',
  '/setup',
  '/key-usage',
  '/download/desktop',
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
  '/purchase': '/checkout',
  '/orders': '/account/orders',
  '/redeem': '/account/redeem',
  '/affiliate': '/account/affiliate',
  '/available-channels': '/account/channels',
  '/monitor': '/account/monitor',
  '/batch-image': '/account/batch-image',
  '/desktop-auth': '/desktop-auth',
  '/payment/result': '/payment/result',
  '/payment/qrcode': '/checkout',
  '/payment/stripe': '/checkout',
  '/payment/airwallex': '/checkout',
  '/payment/stripe-popup': '/checkout',
}

export function isConsolePublicPath(path: string): boolean {
  if (CONSOLE_PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) return true
  // OAuth / SSO exact routes already covered by prefixes
  return false
}

export function isConsoleAdminPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/')
}

export function mapConsolePathToApex(path: string, search = ''): string | null {
  const exact = APEX_CUSTOMER_PATH_MAP[path]
  if (exact) return `${apexOrigin()}${exact}${search}`
  if (path.startsWith('/custom/')) return `${apexOrigin()}/account${search}`
  if (path.startsWith('/payment/')) return `${apexOrigin()}/checkout${search}`
  return null
}

/**
 * Absolute apex URL for a path (used by admin "open customer shell" links).
 */
export function apexUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${apexOrigin()}${p}`
}
