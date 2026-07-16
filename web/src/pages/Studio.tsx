import { Link } from 'react-router-dom'
import { BRAND_NAME } from '@/lib/brand'

export function Studio() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {BRAND_NAME} <span className="bx-gradient-text">Studio</span>
      </h1>
      <p className="mt-4 text-lg text-[var(--bx-text-muted)]">
        Desktop app for running AI agents on your computer. Sign in with your {BRAND_NAME} account
        (browser PKCE), then use the same gateway models you already pay for in the console.
      </p>
      <ul className="mt-8 space-y-3 text-[var(--bx-text-soft)]">
        <li className="bx-card p-4">• Local agent runtime with account-backed model access</li>
        <li className="bx-card p-4">• Secure browser login — no shared cookie domain tricks</li>
        <li className="bx-card p-4">• macOS, Windows, and Linux builds on GitHub Releases</li>
      </ul>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/download" className="bx-btn bx-btn-primary">
          Download
        </Link>
        <Link to="/create" className="bx-btn bx-btn-ghost">
          Try Creator in browser
        </Link>
      </div>
    </div>
  )
}
