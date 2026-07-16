/**
 * BOXAI: Safe relative path for post-auth / SSO redirects.
 *
 * Validates the **pathname** only (segment before `?` / `#`). The query string
 * may contain absolute URLs (e.g. cold SSO `redirect_uri=https://console…`).
 * Rejects open redirects: protocol-relative (`//evil`), schemes in the path,
 * backslashes.
 */
export function safeReturnPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback
  const input = raw.trim()
  if (!input) return fallback

  // Reject ASCII control characters without a control-character regex (eslint no-control-regex).
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return fallback
  }

  const q = input.indexOf('?')
  const h = input.indexOf('#')
  let cut = input.length
  if (q >= 0) cut = Math.min(cut, q)
  if (h >= 0) cut = Math.min(cut, h)

  let pathname = input.slice(0, cut)
  const rest = input.slice(cut)

  try {
    pathname = decodeURIComponent(pathname)
  } catch {
    return fallback
  }
  pathname = pathname.trim()

  if (!pathname.startsWith('/')) return fallback
  if (pathname.startsWith('//')) return fallback
  if (pathname.includes('\\')) return fallback
  if (pathname.includes('://')) return fallback

  return pathname + rest
}
