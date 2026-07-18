import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { AuthSplitLayout } from './AuthSplitLayout'

export function ForgotPassword() {
  const { d } = useI18n()
  const t = d.authForms
  usePageMeta(t.forgotTitle)

  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const res = await forgotPassword(email.trim())
      setMessage(res.message || t.forgotSent)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.forgotFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthSplitLayout title={t.forgotTitle} subtitle={t.forgotSubtitle}>
      <form onSubmit={onSubmit} className="bx-auth-fields">
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
        {error ? <p className="bx-auth-error">{error}</p> : null}
        {message ? <p className="bx-auth-msg">{message}</p> : null}
        <button type="submit" className="bx-auth-cta" disabled={busy}>
          {busy ? d.common.loading : t.sendReset}
        </button>
      </form>
      <p className="bx-auth-switch">
        <Link to="/login">{t.switchDirectLogin}</Link>
      </p>
    </AuthSplitLayout>
  )
}
