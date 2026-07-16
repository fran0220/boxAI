import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BRAND_LOGO_SVG } from '@/lib/brand'
import { consoleOrigin } from '@/lib/brand'
import { createPkcePair } from '@/lib/pkce'
import { saveSsoPending } from '@/lib/storage'
import { useAuth } from '@/lib/use-auth'
import { safeReturnPath } from '@/lib/safe-return'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

/**
 * No credential forms on this origin — the console (Vue app) is the identity
 * host. This route mints a local PKCE pair and hands off to the console:
 *
 *   login  → console /boxai/sso/authorize?code_challenge&redirect_uri&state
 *   signup → console /register?redirect=<that authorize path>
 *
 * The console mints a one-time code after login/registration and returns to
 * /sso/callback here, which exchanges it for this origin's JWT pair.
 */
export function AuthRedirect({ mode }: { mode: 'login' | 'register' }) {
  const { d } = useI18n()
  usePageMeta(mode === 'register' ? d.auth.signupTitle : d.auth.loginTitle)
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const { status } = useAuth()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const state = location.state as { from?: string } | null
      const params = new URLSearchParams(location.search)
      const returnTo = safeReturnPath(state?.from || params.get('return_to'), '/create')

      if (status === 'bootstrapping') return
      if (status === 'authenticated') {
        navigate(returnTo, { replace: true })
        return
      }

      const { verifier, challenge, state: pkceState } = await createPkcePair()
      if (cancelled) return
      saveSsoPending({ verifier, state: pkceState, returnTo })

      const redirectUri = `${window.location.origin}/sso/callback`
      const authorize = new URLSearchParams({
        code_challenge: challenge,
        redirect_uri: redirectUri,
        state: pkceState,
      })
      const authorizePath = `/boxai/sso/authorize?${authorize.toString()}`

      const target =
        mode === 'register'
          ? `${consoleOrigin()}/register?redirect=${encodeURIComponent(authorizePath)}`
          : `${consoleOrigin()}${authorizePath}`
      window.location.href = target
    })().catch(() => {
      if (!cancelled) setError(d.auth.errStart)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, status])

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="bx-display text-xl font-semibold tracking-tight">{d.auth.failedTitle}</h1>
        <p className="mt-3 text-sm text-[var(--bx-text-muted)]">{error}</p>
        <button type="button" className="bx-btn bx-btn-primary mt-8" onClick={() => window.location.reload()}>
          {d.common.retry}
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-20 text-center">
      <img src={BRAND_LOGO_SVG} alt="" className="h-14 w-14" />
      <Spinner className="mt-8" />
      <p className="bx-display mt-5 text-sm font-medium tracking-tight">
        {mode === 'register' ? d.auth.redirectingSignup : d.auth.redirectingLogin}
      </p>
      <p className="mt-2 text-xs text-[var(--bx-text-dim)]">{d.auth.redirectBody}</p>
    </div>
  )
}
