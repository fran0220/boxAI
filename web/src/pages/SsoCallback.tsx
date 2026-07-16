import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exchangeSsoToken, ApiError } from '@/lib/api'
import { takeSsoPending } from '@/lib/storage'
import { safeReturnPath } from '@/lib/safe-return'
import { useI18n } from '@/i18n'
import { Spinner } from '@/components/ui/Spinner'

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
  const { d } = useI18n()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { code, state } = parseFragment()
        const pending = takeSsoPending()
        if (!code) {
          setError(d.auth.errMissingCode)
          return
        }
        if (!pending?.verifier) {
          setError(d.auth.errMissingVerifier)
          return
        }
        // Fail closed on state: require stored expected state and exact match.
        if (!pending.state || !state || pending.state !== state) {
          setError(d.auth.errStateMismatch)
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
          setError(err instanceof ApiError ? err.message : d.auth.errExchange)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">{d.auth.callbackFailedTitle}</h1>
        <p className="mt-3 text-sm text-[var(--bx-text-muted)]">{error}</p>
        <button type="button" className="bx-btn bx-btn-primary mt-8" onClick={() => navigate('/login')}>
          {d.auth.backToLogin}
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 py-20 text-center">
      <Spinner />
      <p className="mt-4 text-sm text-[var(--bx-text-muted)]">{d.auth.completing}</p>
    </div>
  )
}
