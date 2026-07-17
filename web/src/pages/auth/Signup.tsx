import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { completeRegistration, prepareRegistration } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { safeReturnPath } from '@/lib/safe-return'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { useAuth } from '@/lib/use-auth'
import { BRAND_LOGO_SVG } from '@/lib/brand'
import { Spinner } from '@/components/ui/Spinner'

export function Signup() {
  const { d } = useI18n()
  const t = d.authForms
  usePageMeta(d.auth.signupTitle)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { status } = useAuth()
  const returnTo = safeReturnPath(params.get('return_to'), '/account')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [txId, setTxId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(returnTo, { replace: true })
    }
  }, [status, returnTo, navigate])

  if (status === 'bootstrapping' || status === 'authenticated') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  async function onPrepare(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await prepareRegistration({ email: email.trim(), password })
      setTxId(res.transaction_id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.signupFailed)
    } finally {
      setBusy(false)
    }
  }

  async function onComplete(e: React.FormEvent) {
    e.preventDefault()
    if (!txId) return
    setBusy(true)
    setError('')
    try {
      await completeRegistration(txId, code.trim())
      navigate(returnTo, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.verifyFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bx-account-auth-shell px-4 sm:px-6">
      <div className="mb-8 text-center">
        <img src={BRAND_LOGO_SVG} alt="" className="mx-auto h-10 w-10" />
        <h1 className="bx-account-page-title mt-4 text-center">{d.auth.signupTitle}</h1>
        <p className="bx-account-page-sub text-center">{t.signupSubtitle}</p>
      </div>

      {!txId ? (
        <form onSubmit={onPrepare} className="bx-account-auth-card space-y-4">
          <label className="block text-sm">
            <span className="text-[var(--bx-text-muted)]">{t.email}</span>
            <input
              type="email"
              className="bx-input mt-1 w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--bx-text-muted)]">{t.password}</span>
            <input
              type="password"
              className="bx-input mt-1 w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {error ? <p className="bx-text-danger text-sm">{error}</p> : null}
          <button type="submit" className="bx-btn bx-btn-primary w-full" disabled={busy}>
            {busy ? d.common.loading : t.sendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={onComplete} className="bx-account-auth-card space-y-4">
          <p className="text-sm text-[var(--bx-text-muted)]">{t.codeSent.replace('{email}', email)}</p>
          <label className="block text-sm">
            <span className="text-[var(--bx-text-muted)]">{t.verifyCode}</span>
            <input
              className="bx-input mt-1 w-full tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
            />
          </label>
          {error ? <p className="bx-text-danger text-sm">{error}</p> : null}
          <button type="submit" className="bx-btn bx-btn-primary w-full" disabled={busy}>
            {busy ? d.common.loading : t.completeSignup}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-[var(--bx-text-muted)]">
        <Link to={`/login?return_to=${encodeURIComponent(returnTo)}`} className="transition-colors hover:text-[var(--bx-brand-bright)]">
          {t.toLogin}
        </Link>
      </p>
    </div>
  )
}
