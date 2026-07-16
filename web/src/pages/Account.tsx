import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, KeyRound, LogOut, PanelsTopLeft, Sparkles, Wallet } from 'lucide-react'
import { ensureCreatorKey, fetchMe, logout, ApiError } from '@/lib/api'
import { getUser, type AuthUser } from '@/lib/storage'
import { consoleOrigin } from '@/lib/brand'
import { usePageMeta } from '@/lib/meta'
import { useI18n } from '@/i18n'
import { Reveal } from '@/components/motion/Reveal'

export function Account() {
  const { d } = useI18n()
  usePageMeta(d.account.metaTitle)

  const [user, setUser] = useState<AuthUser | null>(getUser())
  const [keyInfo, setKeyInfo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await fetchMe()
        if (!cancelled) setUser(me)
        const key = await ensureCreatorKey()
        if (!cancelled) {
          setKeyInfo(`${key.created ? d.account.keyCreated : d.account.keyReady} · ${key.name}`)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : d.account.keyFailed)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [d])

  async function onLogout() {
    await logout()
    window.location.href = '/'
  }

  const console_ = consoleOrigin()
  const sso = (returnTo?: string) =>
    `${console_}/boxai/sso/start${returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ''}`

  const email = (user?.email as string) || '—'
  const username = (user?.username as string) || '—'
  const role = (user?.role as string) || '—'
  const initial = (email !== '—' ? email : username).charAt(0).toUpperCase()

  const quickLinks = [
    { label: d.account.openConsole, href: sso(), icon: PanelsTopLeft },
    { label: d.account.billing, href: sso('/purchase'), icon: Wallet },
    { label: d.account.apiKeys, href: sso('/keys'), icon: KeyRound },
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
      <Reveal>
        <h1 className="bx-display text-3xl font-bold tracking-tight">{d.account.title}</h1>
        <p className="mt-2 text-sm text-[var(--bx-text-muted)]">{d.account.subtitle}</p>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="bx-card mt-8 overflow-hidden">
          <div className="flex items-center gap-4 border-b border-[var(--bx-border)] p-6">
            <div className="bx-display flex h-14 w-14 items-center justify-center rounded-[var(--bx-radius-md)] bg-[var(--bx-grad-cta)] text-xl font-bold text-[var(--bx-brand-ink)]">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{email}</p>
              <p className="mt-0.5 text-xs text-[var(--bx-text-dim)]">
                {d.account.username}: {username} · {d.account.role}: {role}
              </p>
            </div>
          </div>
          <div className="space-y-2 p-6 text-sm">
            {keyInfo ? (
              <p className="flex items-center gap-2 text-[var(--bx-brand-bright)]">
                <Sparkles size={15} className="text-[var(--bx-spark)]" />
                {keyInfo}
              </p>
            ) : !error ? (
              <p className="text-[var(--bx-text-dim)]">{d.account.loading}</p>
            ) : null}
            {error ? <p className="bx-text-danger text-sm">{error}</p> : null}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.16}>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {quickLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="bx-card bx-card-hover flex items-center gap-3 p-4 text-sm font-medium"
            >
              <link.icon size={17} className="text-[var(--bx-brand-bright)]" />
              {link.label}
            </a>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.24}>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/create" className="bx-btn bx-btn-primary">
            {d.account.goCreator}
            <ArrowRight size={15} />
          </Link>
          <button type="button" onClick={onLogout} className="bx-btn bx-btn-ghost">
            <LogOut size={15} />
            {d.account.logout}
          </button>
        </div>
        <p className="mt-8 text-xs text-[var(--bx-text-dim)]">{d.account.note}</p>
      </Reveal>
    </div>
  )
}
