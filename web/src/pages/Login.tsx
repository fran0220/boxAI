import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login, login2fa, ApiError } from '@/lib/api'
import { BRAND_LOGO_SVG, BRAND_NAME } from '@/lib/brand'
import { safeReturnPath } from '@/lib/safe-return'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  // Honor location.state.from for cold SSO / protected routes; reject open redirects.
  const from = safeReturnPath((location.state as { from?: string } | null)?.from, '/create')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [code2fa, setCode2fa] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (tempToken) {
        await login2fa(tempToken, code2fa)
        navigate(from, { replace: true })
        return
      }
      const res = await login(email.trim(), password)
      if (res.requires_2fa && res.temp_token) {
        setTempToken(res.temp_token)
        return
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="text-center">
        <img src={BRAND_LOGO_SVG} alt="" className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-2xl font-semibold">Log in to {BRAND_NAME}</h1>
      </div>
      <form onSubmit={onSubmit} className="bx-card mt-8 space-y-4 p-6">
        {!tempToken ? (
          <>
            <div>
              <label className="bx-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="bx-input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="bx-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="bx-input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div>
            <label className="bx-label" htmlFor="code2fa">
              Authenticator code
            </label>
            <input
              id="code2fa"
              className="bx-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code2fa}
              onChange={(e) => setCode2fa(e.target.value)}
            />
          </div>
        )}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button type="submit" disabled={busy} className="bx-btn bx-btn-primary w-full disabled:opacity-60">
          {busy ? 'Working…' : tempToken ? 'Verify' : 'Log in'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--bx-text-muted)]">
        No account?{' '}
        <Link to="/signup" state={{ from }} className="text-[var(--bx-teal)] underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
