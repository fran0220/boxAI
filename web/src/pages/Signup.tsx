import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { register, ApiError } from '@/lib/api'
import { BRAND_LOGO_SVG, BRAND_NAME } from '@/lib/brand'
import { safeReturnPath } from '@/lib/safe-return'

export function Signup() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = safeReturnPath((location.state as { from?: string } | null)?.from, '/create')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await register({
        email: email.trim(),
        password,
        username: username.trim() || undefined,
      })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="text-center">
        <img src={BRAND_LOGO_SVG} alt="" className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-2xl font-semibold">Create your {BRAND_NAME} account</h1>
      </div>
      <form onSubmit={onSubmit} className="bx-card mt-8 space-y-4 p-6">
        <div>
          <label className="bx-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="bx-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="bx-label" htmlFor="username">
            Username (optional)
          </label>
          <input
            id="username"
            className="bx-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button type="submit" disabled={busy} className="bx-btn bx-btn-primary w-full disabled:opacity-60">
          {busy ? 'Creating…' : 'Sign up'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--bx-text-muted)]">
        Already have an account?{' '}
        <Link to="/login" state={{ from }} className="text-[var(--bx-teal)] underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
