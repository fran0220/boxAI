import { useEffect, useState } from 'react'
import { getTotpStatus, revokeAllSessions } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

export function AccountSecurity() {
  const { d } = useI18n()
  const t = d.accountSecurity
  usePageMeta(t.metaTitle)

  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await getTotpStatus()
        if (!cancelled) setTotpEnabled(!!s.enabled)
      } catch {
        if (!cancelled) setTotpEnabled(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onRevoke() {
    if (!window.confirm(t.confirmRevoke)) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await revokeAllSessions()
      setMessage(t.revoked)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.revokeFailed)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <h2 className="bx-display text-2xl font-bold tracking-tight">{t.title}</h2>
      <p className="mt-1 text-sm text-[var(--bx-text-muted)]">{t.subtitle}</p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-[var(--bx-brand-bright)]">{message}</p> : null}

      <div className="bx-card mt-6 space-y-3 p-5">
        <h3 className="font-semibold">{t.twoFactor}</h3>
        <p className="text-sm text-[var(--bx-text-muted)]">
          {totpEnabled === null ? t.twoFactorUnknown : totpEnabled ? t.twoFactorOn : t.twoFactorOff}
        </p>
        <p className="text-xs text-[var(--bx-text-dim)]">{t.twoFactorHint}</p>
      </div>

      <div className="bx-card mt-4 space-y-3 p-5">
        <h3 className="font-semibold">{t.sessions}</h3>
        <p className="text-sm text-[var(--bx-text-muted)]">{t.sessionsBody}</p>
        <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" disabled={busy} onClick={() => void onRevoke()}>
          {t.revokeAll}
        </button>
      </div>
    </div>
  )
}
