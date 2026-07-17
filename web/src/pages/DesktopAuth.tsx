import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authorizeDesktopLogin } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/use-auth'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'
import { ProtectedRoute } from '@/components/ProtectedRoute'

const DESKTOP_SCHEME = 'boxai-desktop://'

function DesktopAuthInner() {
  const { d } = useI18n()
  const t = d.desktopAuth
  usePageMeta(t.metaTitle)
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'working' | 'redirecting' | 'error'>('working')
  const [error, setError] = useState('')
  const [redirectTarget, setRedirectTarget] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const codeChallenge = params.get('code_challenge') || ''
      const redirectUri = params.get('redirect_uri') || ''
      const state = params.get('state') || ''

      if (!codeChallenge || !redirectUri) {
        setStatus('error')
        setError(t.missingParams)
        return
      }
      // Align with backend isAllowedDesktopRedirectURI: custom scheme only.
      // Loopback HTTP was previously accepted in SPA then rejected by authorize.
      if (!redirectUri.toLowerCase().startsWith(DESKTOP_SCHEME)) {
        setStatus('error')
        setError(t.badRedirect)
        return
      }

      try {
        const res = await authorizeDesktopLogin({
          code_challenge: codeChallenge,
          redirect_uri: redirectUri,
          state: state || undefined,
        })
        if (cancelled) return
        const sep = redirectUri.includes('?') ? '&' : '?'
        const q = new URLSearchParams()
        q.set('code', res.code)
        if (state) q.set('state', state)
        const target = `${redirectUri}${sep}${q.toString()}`
        setRedirectTarget(target)
        setStatus('redirecting')
        window.location.href = target
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(err instanceof ApiError ? err.message : t.failed)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params, t.badRedirect, t.failed, t.missingParams])

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
      {status === 'working' ? (
        <>
          <Spinner />
          <h1 className="bx-display mt-4 text-xl font-bold">{t.working}</h1>
          <p className="mt-2 text-sm text-[var(--bx-text-muted)]">{t.workingBody}</p>
        </>
      ) : null}
      {status === 'redirecting' ? (
        <>
          <h1 className="bx-display text-xl font-bold">{t.redirecting}</h1>
          <p className="mt-2 text-sm text-[var(--bx-text-muted)]">{t.redirectingBody}</p>
          {redirectTarget ? (
            <a href={redirectTarget} className="bx-btn bx-btn-primary mt-6 inline-flex">
              {t.openDesktop}
            </a>
          ) : null}
        </>
      ) : null}
      {status === 'error' ? (
        <>
          <h1 className="bx-display text-xl font-bold">{t.error}</h1>
          <p className="bx-text-danger mt-2 text-sm">{error}</p>
          <Link to="/login" className="bx-btn bx-btn-primary mt-6 inline-flex">
            {d.auth.backToLogin}
          </Link>
        </>
      ) : null}
    </div>
  )
}

export function DesktopAuth() {
  const { status } = useAuth()
  if (status === 'bootstrapping') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }
  return (
    <ProtectedRoute>
      <DesktopAuthInner />
    </ProtectedRoute>
  )
}
