import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { BRAND_LOGO_SVG } from '@/lib/brand'

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
    <div className="bx-account-auth-shell px-4 sm:px-6">
      <div className="mb-8 text-center">
        <img src={BRAND_LOGO_SVG} alt="" className="mx-auto h-10 w-10" />
        <h1 className="bx-account-page-title mt-4 text-center">{t.forgotTitle}</h1>
        <p className="bx-account-page-sub text-center">{t.forgotSubtitle}</p>
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
        {error ? <p className="bx-text-danger text-sm">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--bx-brand-bright)]">{message}</p> : null}
        <button type="submit" className="bx-btn bx-btn-primary w-full" disabled={busy}>
          {busy ? d.common.loading : t.sendReset}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-[var(--bx-text-muted)] hover:text-[var(--bx-text)]">
          {t.toLogin}
        </Link>
      </p>
    </div>
  )
}
