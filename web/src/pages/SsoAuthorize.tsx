import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authorizeSso, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/use-auth'
import { Spinner } from '@/components/ui/Spinner'
import { useI18n } from '@/i18n'

/**
 * Cross-origin authorize side (PKCE).
 *
 * Console cold-start opens:
 *   /sso/authorize?code_challenge=...&redirect_uri=...&state=...
 * while the user may already be logged in on the marketing origin.
 * We mint a one-time code with this origin's JWT and redirect to
 * redirect_uri with #code=&state= (fragment so intermediaries never see it).
 *
 * Credential forms still live only on the console — if this origin is cold
 * we send the user through /login (AuthRedirect → console) and return here.
 */
export function SsoAuthorize() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { d } = useI18n()
  const [error, setError] = useState('')
  const { status } = useAuth()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const codeChallenge = params.get('code_challenge') || ''
      const redirectUri = params.get('redirect_uri') || ''
      const state = params.get('state') || ''

      if (status === 'bootstrapping') return
      if (status !== 'authenticated') {
        // Preserve the full authorize query so we resume minting after login.
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
  }, [navigate, params, status])

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="bx-display text-xl font-semibold tracking-tight">{d.auth.failedTitle}</h1>
        <p className="mt-2 text-sm text-[var(--bx-text-muted)]">{error}</p>
        <button type="button" className="bx-btn bx-btn-primary mt-8" onClick={() => navigate('/login')}>
          {d.auth.backToLogin}
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 py-20 text-center">
      <Spinner />
      <p className="mt-4 text-sm text-[var(--bx-text-muted)]">{d.auth.ssoWorking}</p>
    </div>
  )
}
