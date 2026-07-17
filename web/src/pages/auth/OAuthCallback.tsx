import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  parseOAuthFragment,
  runOAuthCallbackOnce,
} from '@/lib/oauth-pending'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Apex OAuth completion page.
 *
 * Completion modes:
 *  (A) `#auth_result=session` — host cookie already set; bootstrap memory JWT
 *  (B) empty fragment + pending cookies — POST …/oauth/pending/exchange
 *      (LinuxDo / WeChat / OIDC / DingTalk existing-user login and Profile bind)
 *  (B′) adoption_required only — second exchange declines suggested profile
 *
 * Multi-step registration (invitation / create-vs-bind / TOTP) stays parked:
 * show error + email signup CTA. Pending cookies are HttpOnly (10m TTL);
 * OAuth start and successful exchange clear them server-side.
 *
 * Uses `runOAuthCallbackOnce` so React StrictMode remounts share one exchange.
 */
export function OAuthCallback() {
  const { d } = useI18n()
  const t = d.authForms
  usePageMeta(t.oauthCallbackTitle)
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      const frag = parseOAuthFragment(hash)
      // Strip fragment from the address bar immediately (no credentials in history).
      if (typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }

      // Shared promise: first mount runs exchange; StrictMode remount reuses it.
      const outcome = await runOAuthCallbackOnce(frag, { defaultRedirect: '/account' })
      if (cancelled) return

      if (outcome.kind === 'authenticated') {
        // Clear busy before navigate so a no-op/same-route replace cannot leave
        // a perpetual “Completing login…” spinner.
        setBusy(false)
        navigate(outcome.redirect, { replace: true })
        return
      }
      if (outcome.kind === 'parked') {
        setError(t.oauthPendingUnsupported)
        setBusy(false)
        return
      }
      // Provider fragment errors keep descriptive text; exchange/session use i18n.
      const isInternal =
        outcome.message === 'session_bootstrap_failed' || outcome.message === 'exchange_failed'
      setError(isInternal || !outcome.message ? t.oauthFailed : outcome.message)
      setBusy(false)
    })()
    return () => {
      cancelled = true
    }
  }, [navigate, t.oauthFailed, t.oauthPendingUnsupported])

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-4 py-14 text-center sm:px-6">
      {busy ? (
        <>
          <Spinner className="mx-auto" />
          <h1 className="bx-display mt-4 text-xl font-bold">{t.oauthCallbackTitle}</h1>
          <p className="mt-2 text-sm text-[var(--bx-text-muted)]">{t.oauthCallbackHint}</p>
        </>
      ) : (
        <>
          <h1 className="bx-display text-xl font-bold">{t.oauthFailedTitle}</h1>
          <p className="bx-text-danger mt-3 text-sm">{error || t.oauthFailed}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/login" className="bx-btn bx-btn-primary">
              {d.auth.backToLogin}
            </Link>
            <Link to="/signup" className="bx-btn bx-btn-ghost">
              {d.auth.signupTitle}
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
