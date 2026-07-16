import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ensureCreatorKey, fetchMe, logout, ApiError } from '@/lib/api'
import { getUser, type AuthUser } from '@/lib/storage'
import { consoleOrigin } from '@/lib/brand'

export function Account() {
  const [user, setUser] = useState<AuthUser | null>(getUser())
  const [keyInfo, setKeyInfo] = useState<string>('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await fetchMe()
        if (!cancelled) setUser(me)
        const key = await ensureCreatorKey()
        if (!cancelled) {
          // Response never includes plaintext key material (JWT bridge only).
          setKeyInfo(
            key.created
              ? `Prepared Creator gateway key “${key.name}” (id ${key.id}).`
              : `Creator gateway key “${key.name}” ready (id ${key.id}).`,
          )
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load account')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onLogout() {
    await logout()
    window.location.href = '/'
  }

  const ssoConsole = `${consoleOrigin()}/boxai/sso/start`

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold">Account</h1>
      <div className="bx-card mt-6 space-y-3 p-6 text-sm">
        <p>
          <span className="text-[var(--bx-text-muted)]">Email:</span>{' '}
          {(user?.email as string) || '—'}
        </p>
        <p>
          <span className="text-[var(--bx-text-muted)]">Username:</span>{' '}
          {(user?.username as string) || '—'}
        </p>
        <p>
          <span className="text-[var(--bx-text-muted)]">Role:</span> {(user?.role as string) || '—'}
        </p>
        {keyInfo ? <p className="text-[var(--bx-teal)]">{keyInfo}</p> : null}
        {error ? <p className="text-red-400">{error}</p> : null}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href={ssoConsole} className="bx-btn bx-btn-primary">
          Open console (SSO)
        </a>
        <Link to="/create" className="bx-btn bx-btn-ghost">
          Creator
        </Link>
        <button type="button" onClick={onLogout} className="bx-btn bx-btn-ghost">
          Log out
        </button>
      </div>
      <p className="mt-8 text-xs text-[var(--bx-text-dim)]">
        Billing, API keys, and admin tools remain on the console origin. SSO links sessions without
        sharing cookies across subdomains.
      </p>
    </div>
  )
}
