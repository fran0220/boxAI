import { useEffect, useState } from 'react'
import { changePassword, getProfile, updateProfile, type UserProfile } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

export function AccountProfile() {
  const { d } = useI18n()
  const t = d.accountProfile
  usePageMeta(t.metaTitle)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [username, setUsername] = useState('')
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const p = await getProfile()
        if (cancelled) return
        setProfile(p)
        setUsername(p.username || '')
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t.loadFailed)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t.loadFailed])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const p = await updateProfile({ username: username.trim() })
      setProfile(p)
      setMessage(t.saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await changePassword(oldPw, newPw)
      setOldPw('')
      setNewPw('')
      setMessage(t.passwordChanged)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.passwordFailed)
    } finally {
      setSaving(false)
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

      <form onSubmit={saveProfile} className="bx-card mt-6 space-y-3 p-5">
        <label className="block text-sm">
          <span className="text-[var(--bx-text-muted)]">{t.email}</span>
          <input className="bx-input mt-1 w-full opacity-70" value={profile?.email || ''} disabled />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--bx-text-muted)]">{t.username}</span>
          <input className="bx-input mt-1 w-full" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <p className="text-xs text-[var(--bx-text-dim)]">
          {t.balance}: ${profile?.balance?.toFixed(2) ?? '—'} · {t.concurrency}: {profile?.concurrency ?? '—'}
        </p>
        <button type="submit" className="bx-btn bx-btn-primary bx-btn-sm" disabled={saving}>
          {d.common.save}
        </button>
      </form>

      <form onSubmit={savePassword} className="bx-card mt-4 space-y-3 p-5">
        <h3 className="font-semibold">{t.changePassword}</h3>
        <label className="block text-sm">
          <span className="text-[var(--bx-text-muted)]">{t.oldPassword}</span>
          <input
            type="password"
            className="bx-input mt-1 w-full"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--bx-text-muted)]">{t.newPassword}</span>
          <input
            type="password"
            className="bx-input mt-1 w-full"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <button type="submit" className="bx-btn bx-btn-primary bx-btn-sm" disabled={saving}>
          {t.updatePassword}
        </button>
      </form>
    </div>
  )
}
