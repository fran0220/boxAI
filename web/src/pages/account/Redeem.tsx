import { useEffect, useState } from 'react'
import { getProfile, getRedeemHistory, redeemCode, type RedeemHistoryItem } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

export function AccountRedeem() {
  const { d } = useI18n()
  const t = d.accountRedeem
  usePageMeta(t.metaTitle)

  const [code, setCode] = useState('')
  const [history, setHistory] = useState<RedeemHistoryItem[]>([])
  const [balance, setBalance] = useState<number | null>(null)
  const [historyReady, setHistoryReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadHistory(isBoot = false) {
    try {
      const h = await getRedeemHistory()
      setHistory(h || [])
    } catch (err) {
      if (isBoot) {
        setError(err instanceof ApiError ? err.message : t.historyLoadFailed)
      }
      // keep previous history on subsequent failures
    } finally {
      setHistoryReady(true)
    }
  }

  async function loadBalance() {
    try {
      const p = await getProfile()
      if (typeof p.balance === 'number') setBalance(p.balance)
    } catch {
      /* optional */
    }
  }

  useEffect(() => {
    void loadHistory(true)
    void loadBalance()
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
      await Promise.all([loadHistory(false), loadBalance()])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="bx-account-page-title">{t.title}</h1>
      <p className="bx-account-page-sub">{t.subtitle}</p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-[var(--bx-brand-bright)]">{message}</p> : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={onSubmit} className="bx-account-panel px-6 py-[22px]">
          <p className="bx-account-mono-label">{t.codeLabel}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="bx-account-input-muted flex-1 font-mono text-[15px] tracking-widest"
              placeholder={t.placeholder}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button type="submit" className="bx-btn bx-btn-primary px-[22px]" disabled={busy}>
              {busy ? d.common.loading : t.submit}
            </button>
          </div>
          <p className="mt-3.5 mb-0 text-xs leading-relaxed text-[var(--bx-text-dim)]">{t.helpText}</p>
        </form>

        <div className="bx-account-panel-grad flex flex-col justify-center">
          <p className="bx-account-mono-label">{t.currentBalance}</p>
          <p className="bx-account-stat-value bx-account-stat-value--lg">
            {balance != null ? `$${balance.toFixed(2)}` : '—'}
          </p>
          <p className="bx-account-stat-hint" style={{ color: 'var(--bx-success)' }}>
            {historyReady
              ? t.historyCount.replace('{n}', String(history.length))
              : d.common.loading}
          </p>
        </div>
      </div>

      <div className="bx-account-table-wrap mt-3">
        <p className="m-0 px-5 pb-2.5 pt-3.5 text-[13.5px] font-bold">{t.history}</p>
        {!historyReady ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : history.length === 0 ? (
          <p className="bx-account-empty">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="bx-account-table min-w-[480px]">
              <thead>
                <tr>
                  <th>{t.colCode}</th>
                  <th>{t.colType}</th>
                  <th className="text-right">{t.colValue}</th>
                  <th>{t.colTime}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono text-[11.5px] text-[var(--bx-text-soft)]">{item.code}</td>
                    <td className="text-[var(--bx-text-muted)]">
                      {item.type}
                      {item.group?.name ? ` · ${item.group.name}` : ''}
                    </td>
                    <td className="num text-right font-semibold text-[var(--bx-success)]">
                      +{item.value}
                    </td>
                    <td className="font-mono text-[10.5px] text-[var(--bx-text-dim)]">
                      {item.used_at ? new Date(item.used_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
