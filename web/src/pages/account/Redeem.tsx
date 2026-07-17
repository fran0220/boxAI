import { useEffect, useState } from 'react'
import { getRedeemHistory, redeemCode, type RedeemHistoryItem } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'

export function AccountRedeem() {
  const { d } = useI18n()
  const t = d.accountRedeem
  usePageMeta(t.metaTitle)

  const [code, setCode] = useState('')
  const [history, setHistory] = useState<RedeemHistoryItem[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadHistory() {
    try {
      const h = await getRedeemHistory()
      setHistory(h || [])
    } catch {
      // history is secondary
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const res = await redeemCode(code.trim())
      setMessage(res.message || t.success)
      setCode('')
      await loadHistory()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h2 className="bx-display text-2xl font-bold tracking-tight">{t.title}</h2>
      <p className="mt-1 text-sm text-[var(--bx-text-muted)]">{t.subtitle}</p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-[var(--bx-brand-bright)]">{message}</p> : null}

      <form onSubmit={onSubmit} className="bx-card mt-6 flex flex-col gap-3 p-5 sm:flex-row">
        <input
          className="bx-input flex-1"
          placeholder={t.placeholder}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <button type="submit" className="bx-btn bx-btn-primary" disabled={busy}>
          {busy ? d.common.loading : t.submit}
        </button>
      </form>

      <h3 className="mt-8 text-sm font-semibold">{t.history}</h3>
      {history.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--bx-text-dim)]">{t.empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {history.map((item) => (
            <li key={item.id} className="bx-card flex justify-between gap-3 p-3 text-sm">
              <div>
                <p className="font-mono text-xs">{item.code}</p>
                <p className="text-xs text-[var(--bx-text-dim)]">
                  {item.type} · {item.value}
                  {item.group?.name ? ` · ${item.group.name}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-xs text-[var(--bx-text-muted)]">
                {item.used_at ? new Date(item.used_at).toLocaleDateString() : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
