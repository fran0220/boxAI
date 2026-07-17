import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { completeRegistration, prepareRegistration } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { safeReturnPath } from '@/lib/safe-return'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { useAuth } from '@/lib/use-auth'
import { consoleOrigin } from '@/lib/brand'
import { Spinner } from '@/components/ui/Spinner'
import { AuthSplitLayout } from './AuthSplitLayout'

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
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bx-bg)]">
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

  const loginHref =
    returnTo && returnTo !== '/account'
      ? `/login?return_to=${encodeURIComponent(returnTo)}`
      : '/login'

  const termsHref = `${consoleOrigin()}/legal/terms`
  const privacyHref = `${consoleOrigin()}/legal/privacy`

  return (
    <AuthSplitLayout
      activeTab="signup"
      title={txId ? t.verifyEmailTitle : t.createAccount}
      subtitle={txId ? t.codeSent.replace('{email}', email) : t.signupSubtitle}
      returnTo={returnTo}
    >
      {!txId ? (
        <form onSubmit={onPrepare} className="bx-auth-fields">
          <label className="bx-auth-label">
            <span className="bx-auth-label-text">{t.email}</span>
            <input
              type="email"
              className="bx-auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label className="bx-auth-label">
            <span className="bx-auth-label-text">{t.password}</span>
            <input
              type="password"
              className="bx-auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="••••••••"
            />
          </label>
          {error ? <p className="bx-auth-error">{error}</p> : null}
          <button type="submit" className="bx-auth-cta" disabled={busy}>
            {busy ? d.common.loading : t.sendCode}
          </button>
          <p className="bx-auth-terms">
            {t.signupTermsBefore}
            <a href={termsHref} target="_blank" rel="noreferrer">
              {d.footer.terms}
            </a>
            {t.signupTermsMid}
            <a href={privacyHref} target="_blank" rel="noreferrer">
              {d.footer.privacy}
            </a>
            {t.signupTermsAfter}
          </p>
        </form>
      ) : (
        <form onSubmit={onComplete} className="bx-auth-fields">
          <label className="bx-auth-label">
            <span className="bx-auth-label-text">{t.verifyCode}</span>
            <input
              className="bx-auth-input tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
              placeholder="000000"
              inputMode="numeric"
            />
          </label>
          {error ? <p className="bx-auth-error">{error}</p> : null}
          <button type="submit" className="bx-auth-cta" disabled={busy}>
            {busy ? d.common.loading : t.completeSignup}
          </button>
        </form>
      )}

      <p className="bx-auth-switch">
        {t.switchHaveAccount}{' '}
        <Link to={loginHref}>{t.switchDirectLogin}</Link>
      </p>
    </AuthSplitLayout>
  )
}
