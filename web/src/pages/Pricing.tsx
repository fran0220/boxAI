import { consoleOrigin } from '@/lib/brand'
import { isAuthenticated } from '@/lib/storage'
import { Link } from 'react-router-dom'

export function Pricing() {
  const consoleBilling = `${consoleOrigin()}/billing`
  const ssoStart = `${consoleOrigin()}/boxai/sso/start?return_to=${encodeURIComponent('/billing')}`

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">Pricing & billing</h1>
      <p className="mt-4 text-[var(--bx-text-muted)]">
        Plans, top-ups, and invoices live in the BoxAI console. Creator and Studio use the same account balance
        and API keys.
      </p>
      <div className="bx-card mx-auto mt-10 max-w-md space-y-4 p-8">
        <p className="text-sm text-[var(--bx-text-soft)]">
          Open the console billing page. If you are already signed in here, use SSO to carry your session.
        </p>
        {isAuthenticated() ? (
          <a href={ssoStart} className="bx-btn bx-btn-primary w-full">
            Open billing via SSO
          </a>
        ) : (
          <>
            <Link to="/login" className="bx-btn bx-btn-primary w-full">
              Log in first
            </Link>
            <a href={consoleBilling} className="bx-btn bx-btn-ghost w-full">
              Open console directly
            </a>
          </>
        )}
      </div>
    </div>
  )
}
