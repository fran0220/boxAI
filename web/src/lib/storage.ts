/** Session-scoped helpers for apex customer shell (no cross-origin SSO). */

const RETURN_KEY = 'boxai_return_to'

export function saveReturnTo(path: string): void {
  try {
    sessionStorage.setItem(RETURN_KEY, path)
  } catch {
    // ignore
  }
}

export function takeReturnTo(fallback = '/account'): string {
  try {
    const v = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    return v || fallback
  } catch {
    return fallback
  }
}
