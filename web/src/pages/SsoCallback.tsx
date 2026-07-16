import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exchangeSsoToken, ApiError } from '@/lib/api'
import { takeSsoPending } from '@/lib/storage'
import { safeReturnPath } from '@/lib/safe-return'

function parseFragment(): { code: string; state: string } {
  const hash = window.location.hash.replace(/^#/, '')
  const qs = new URLSearchParams(hash || window.location.search)
  return {
    code: qs.get('code') || '',
    state: qs.get('state') || '',
  }
}

export function SsoCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { code, state } = parseFragment()
        const pending = takeSsoPending()
        if (!code) {
          setError('Missing authorization code.')
          return
        }
        if (!pending?.verifier) {
          setError('Missing PKCE verifier. Restart sign-in from the source site.')
          return
        }
        // Fail closed on state: require stored expected state and exact match.
        if (!pending.state || !state || pending.state !== state) {
          setError('SSO state mismatch. Please try again.')
          return
        }
        const redirectUri = `${window.location.origin}/sso/callback`
        await exchangeSsoToken({
          code,
          codeVerifier: pending.verifier,
          redirectUri,
        })
        window.history.replaceState(null, '', window.location.pathname)
        if (!cancelled) {
          navigate(safeReturnPath(pending.returnTo, '/create'), { replace: true })
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Token exchange failed')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">SSO callback failed</h1>
        <p className="mt-2 text-sm text-[var(--bx-text-muted)]">{error}</p>
        <button type="button" className="bx-btn bx-btn-primary mt-6" onClick={() => navigate('/login')}>
          Back to login
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      <p className="mt-4 text-sm text-[var(--bx-text-muted)]">Completing sign-in…</p>
    </div>
  )
}
