import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { resetPassword } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { AuthSplitLayout } from './AuthSplitLayout'

/**
 * Password-reset links put email + token in the URL fragment (preferred)
 * or query string (legacy). Capture and clear fragment before requests.
 */
export function ResetPassword() {
  const { d } = useI18n()
  const t = d.authForms
  usePageMeta(t.resetTitle)
  const [params] = useSearchParams()

  const [email, setEmail] = useState(params.get('email') || '')
  const [token, setToken] = useState(params.get('token') || '')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash) return
    const hp = new URLSearchParams(hash)
    const e = hp.get('email')
    const tk = hp.get('token')
    if (e) setEmail(e)
    if (tk) setToken(tk)
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const res = await resetPassword({ email: email.trim(), token: token.trim(), new_password: password })
      setMessage(res.message || t.resetOk)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.resetFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthSplitLayout title={t.resetTitle} subtitle={t.resetSubtitle}>
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
        <label className="bx-auth-label">
          <span className="bx-auth-label-text">{t.resetToken}</span>
          <input
            className="bx-auth-input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
        </label>
        <label className="bx-auth-label">
          <span className="bx-auth-label-text">{t.newPassword}</span>
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
        {message ? <p className="bx-auth-msg">{message}</p> : null}
        <button type="submit" className="bx-auth-cta" disabled={busy}>
          {busy ? d.common.loading : t.resetSubmit}
        </button>
      </form>
      <p className="bx-auth-switch">
        <Link to="/login">{t.switchDirectLogin}</Link>
      </p>
    </AuthSplitLayout>
  )
}
