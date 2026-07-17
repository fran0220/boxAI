import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { resetPassword } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { BRAND_LOGO_SVG } from '@/lib/brand'

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
    <div className="bx-account-auth-shell px-4 sm:px-6">
      <div className="mb-8 text-center">
        <img src={BRAND_LOGO_SVG} alt="" className="mx-auto h-10 w-10" />
        <h1 className="bx-account-page-title mt-4 text-center">{t.resetTitle}</h1>
      </div>
      <form onSubmit={onSubmit} className="bx-account-auth-card space-y-4">
        <label className="block text-sm">
          <span className="text-[var(--bx-text-muted)]">{t.email}</span>
          <input
            type="email"
            className="bx-input mt-1 w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--bx-text-muted)]">{t.resetToken}</span>
          <input className="bx-input mt-1 w-full" value={token} onChange={(e) => setToken(e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--bx-text-muted)]">{t.newPassword}</span>
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
        {message ? <p className="text-sm text-[var(--bx-brand-bright)]">{message}</p> : null}
        <button type="submit" className="bx-btn bx-btn-primary w-full" disabled={busy}>
          {busy ? d.common.loading : t.resetSubmit}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-[var(--bx-text-muted)] transition-colors hover:text-[var(--bx-brand-bright)]">
          {t.toLogin}
        </Link>
      </p>
    </div>
  )
}
