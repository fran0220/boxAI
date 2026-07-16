import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exchangeSsoToken, ApiError } from '@/lib/api'
import { captureSsoCallback, exchangeSsoOnce } from '@/lib/sso-exchange'
import { useI18n } from '@/i18n'
import { Spinner } from '@/components/ui/Spinner'

export function SsoCallback() {
  const navigate = useNavigate()
  const { d } = useI18n()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const input = captureSsoCallback()
    ;(async () => {
      try {
        const result = await exchangeSsoOnce(input, exchangeSsoToken)
        if (!cancelled) {
          navigate(result.returnTo, { replace: true })
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : ''
          setError(message === 'missing-code' ? d.auth.errMissingCode : message === 'missing-verifier' ? d.auth.errMissingVerifier : message === 'state-mismatch' ? d.auth.errStateMismatch : err instanceof ApiError ? err.message : d.auth.errExchange)
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
        <h1 className="bx-display text-xl font-semibold tracking-tight">{d.auth.callbackFailedTitle}</h1>
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
