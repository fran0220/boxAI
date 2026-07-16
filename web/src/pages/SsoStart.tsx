import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authorizeSso, ApiError } from '@/lib/api'
import { createPkcePair } from '@/lib/pkce'
import { isAuthenticated, saveSsoPending } from '@/lib/storage'
import { consoleOrigin } from '@/lib/brand'
import { safeReturnPath } from '@/lib/safe-return'

/**
 * Start SSO handoff FROM this origin TO a target (console by default).
 * Query: target=console|self  return_to=path
 */
export function SsoStart() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const fullFrom = `/sso?${params.toString()}`
      if (!isAuthenticated()) {
        // Preserve target/return_to for cold login → back to SSO start.
        navigate('/login', { replace: true, state: { from: fullFrom } })
        return
      }
      try {
        const target = (params.get('target') || 'console').toLowerCase()
        const returnTo = safeReturnPath(
          params.get('return_to'),
          target === 'console' ? '/' : '/create',
        )

        // Console owns PKCE for cross-origin handoff — no local mint needed.
        if (target === 'console') {
          const url = new URL(`${consoleOrigin()}/boxai/sso/start`)
          if (returnTo) url.searchParams.set('return_to', returnTo)
          window.location.href = url.toString()
          return
        }

        const { verifier, challenge, state } = await createPkcePair()
        const redirectUri = `${window.location.origin}/sso/callback`
        saveSsoPending({ verifier, state, returnTo })

        const { code } = await authorizeSso({ codeChallenge: challenge, redirectUri })
        if (cancelled) return
        const hash = new URLSearchParams({ code, state }).toString()
        window.location.replace(`${redirectUri}#${hash}`)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'SSO start failed')
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
        <h1 className="text-xl font-semibold">SSO failed</h1>
        <p className="mt-2 text-sm text-[var(--bx-text-muted)]">{error}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      <p className="mt-4 text-sm text-[var(--bx-text-muted)]">Starting secure sign-in…</p>
    </div>
  )
}
