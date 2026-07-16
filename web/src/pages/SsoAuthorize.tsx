import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authorizeSso, ApiError } from '@/lib/api'
import { isAuthenticated } from '@/lib/storage'

/**
 * Cross-origin authorize side: console (or peer) opens
 * /sso/authorize?code_challenge=...&redirect_uri=...&state=...
 * while user is logged in on marketing. We mint a code and redirect
 * to redirect_uri with #code=&state= (fragment preferred).
 */
export function SsoAuthorize() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const codeChallenge = params.get('code_challenge') || ''
      const redirectUri = params.get('redirect_uri') || ''
      const state = params.get('state') || ''

      if (!isAuthenticated()) {
        const returnUrl = `/sso/authorize?${params.toString()}`
        navigate('/login', { replace: true, state: { from: returnUrl } })
        return
      }
      if (!codeChallenge || !redirectUri) {
        setError('Missing code_challenge or redirect_uri.')
        return
      }
      try {
        const { code } = await authorizeSso({ codeChallenge, redirectUri })
        if (cancelled) return
        const hash = new URLSearchParams()
        hash.set('code', code)
        if (state) hash.set('state', state)
        // Prefer fragment so the code is not sent to intermediate proxies in Referer.
        window.location.replace(`${redirectUri}#${hash.toString()}`)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Authorize failed')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate, params])

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Authorization failed</h1>
        <p className="mt-2 text-sm text-[var(--bx-text-muted)]">{error}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      <p className="mt-4 text-sm text-[var(--bx-text-muted)]">Authorizing…</p>
    </div>
  )
}
