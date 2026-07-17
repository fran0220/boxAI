import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  parseOAuthFragment,
  runOAuthCallbackOnce,
} from '@/lib/oauth-pending'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { BRAND_LOGO_SVG } from '@/lib/brand'
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
/** Three-way status so success never renders the failure card. */
type OAuthCallbackPhase = 'loading' | 'error' | 'done'

export function OAuthCallback() {
  const { d } = useI18n()
  const t = d.authForms
  usePageMeta(t.oauthCallbackTitle)
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<OAuthCallbackPhase>('loading')

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
        // Neutral "done" keeps spinner/redirect UI; never the failure card.
        setPhase('done')
        navigate(outcome.redirect, { replace: true })
        return
      }
      if (outcome.kind === 'parked') {
        setError(t.oauthPendingUnsupported)
        setPhase('error')
        return
      }
      // Provider fragment errors keep descriptive text; exchange/session use i18n.
      const isInternal =
        outcome.message === 'session_bootstrap_failed' || outcome.message === 'exchange_failed'
      setError(isInternal || !outcome.message ? t.oauthFailed : outcome.message)
      setPhase('error')
    })()
    return () => {
      cancelled = true
    }
  }, [navigate, t.oauthFailed, t.oauthPendingUnsupported])

  return (
    <div className="bx-account-auth-shell px-4 sm:px-6">
      <div className="mb-8 text-center">
        <img src={BRAND_LOGO_SVG} alt="" className="mx-auto h-10 w-10" />
        <p className="mt-4 m-0 inline-flex items-center justify-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
          <span className="h-px w-5 bg-[var(--bx-brand)]" />
          {t.oauthEyebrow}
        </p>
        {phase === 'error' ? (
          <>
            <h1 className="bx-account-page-title mt-3.5 text-center">{t.oauthFailedTitle}</h1>
            <p className="bx-text-danger mt-2 text-sm">{error || t.oauthFailed}</p>
          </>
        ) : (
          <>
            <h1 className="bx-account-page-title mt-3.5 text-center">{t.oauthCallbackTitle}</h1>
            <p className="bx-account-page-sub text-center">{t.oauthCallbackHint}</p>
          </>
        )}
      </div>

      {phase === 'error' ? (
        <div className="bx-account-auth-card space-y-4 text-center">
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/login" className="bx-btn bx-btn-primary">
              {d.auth.backToLogin}
            </Link>
            <Link to="/signup" className="bx-btn bx-btn-ghost">
              {d.auth.signupTitle}
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-4 pt-2 text-sm text-[var(--bx-text-muted)]">
            <Link
              to="/login"
              className="transition-colors hover:text-[var(--bx-brand-bright)]"
            >
              {t.toLogin}
            </Link>
            <Link
              to="/signup"
              className="transition-colors hover:text-[var(--bx-brand-bright)]"
            >
              {t.toSignup}
            </Link>
          </div>
        </div>
      ) : (
        <div className="bx-account-auth-card flex flex-col items-center gap-4 py-10 text-center">
          <Spinner />
          <p className="m-0 text-sm text-[var(--bx-text-muted)]">{t.oauthCallbackHint}</p>
        </div>
      )}
    </div>
  )
}
