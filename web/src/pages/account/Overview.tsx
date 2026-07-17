import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, KeyRound, LogOut, Sparkles, Wallet } from 'lucide-react'
import { ensureCreatorKey, logout, ApiError } from '@/lib/api'
import { getProfile, getUsageDashboardStats, type UserProfile, type UserDashboardStats } from '@/lib/customer-api'
import { useAuth } from '@/lib/use-auth'
import { usePageMeta } from '@/lib/meta'
import { useI18n } from '@/i18n'
import { Reveal } from '@/components/motion/Reveal'

export function AccountOverview() {
  const { d } = useI18n()
  usePageMeta(d.account.metaTitle)
  const { user: sessionUser } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<UserDashboardStats | null>(null)
  const [keyInfo, setKeyInfo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [p, s] = await Promise.all([getProfile(), getUsageDashboardStats().catch(() => null)])
        if (cancelled) return
        setProfile(p)
        if (s) setStats(s)
        const key = await ensureCreatorKey()
        if (!cancelled) {
          setKeyInfo(`${key.created ? d.account.keyCreated : d.account.keyReady} · ${key.name}`)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : d.account.keyFailed)
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

  const email = profile?.email || (sessionUser?.email as string) || '—'
  const username = profile?.username || (sessionUser?.username as string) || '—'
  const balance = profile?.balance
  const initial = (email !== '—' ? email : username).charAt(0).toUpperCase()

  return (
    <div>
      <Reveal>
        <h2 className="bx-display text-2xl font-bold tracking-tight">{d.account.title}</h2>
        <p className="mt-1 text-sm text-[var(--bx-text-muted)]">{d.account.subtitle}</p>
      </Reveal>

      <Reveal delay={0.06}>
        <div className="bx-card mt-6 overflow-hidden">
          <div className="flex items-center gap-4 border-b border-[var(--bx-border)] p-6">
            <div className="bx-display flex h-14 w-14 items-center justify-center rounded-[var(--bx-radius-md)] bg-[var(--bx-grad-cta)] text-xl font-bold text-[var(--bx-brand-ink)]">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{email}</p>
              <p className="mt-0.5 text-xs text-[var(--bx-text-dim)]">
                {d.account.username}: {username}
                {typeof balance === 'number' ? ` · ${d.account.balance}: $${balance.toFixed(2)}` : null}
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
            {stats ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label={d.account.statTodayReq} value={String(stats.today_requests)} />
                <Stat label={d.account.statTodayTokens} value={formatNum(stats.today_tokens)} />
                <Stat label={d.account.statKeys} value={`${stats.active_api_keys}/${stats.total_api_keys}`} />
                <Stat label={d.account.statCost} value={`$${(stats.total_actual_cost ?? stats.total_cost).toFixed(2)}`} />
              </div>
            ) : null}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Link to="/account/keys" className="bx-card bx-card-hover flex items-center gap-3 p-4 text-sm font-medium">
            <KeyRound size={17} className="text-[var(--bx-brand-bright)]" />
            {d.account.apiKeys}
          </Link>
          <Link to="/checkout" className="bx-card bx-card-hover flex items-center gap-3 p-4 text-sm font-medium">
            <Wallet size={17} className="text-[var(--bx-brand-bright)]" />
            {d.account.billing}
          </Link>
          <Link to="/account/usage" className="bx-card bx-card-hover flex items-center gap-3 p-4 text-sm font-medium">
            <Sparkles size={17} className="text-[var(--bx-brand-bright)]" />
            {d.accountNav.usage}
          </Link>
        </div>
      </Reveal>

      <Reveal delay={0.18}>
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
      </Reveal>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--bx-radius-sm)] bg-[var(--bx-bg-muted)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[var(--bx-text-dim)]">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
