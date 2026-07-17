import { useEffect, useMemo, useState } from 'react'
import { getAffiliate, transferAffiliateQuota, type AffiliateDetail } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'
import { Copy } from 'lucide-react'

export function AccountAffiliate() {
  const { d } = useI18n()
  const t = d.accountAffiliate
  usePageMeta(t.metaTitle)

  const [data, setData] = useState<AffiliateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const a = await getAffiliate()
      setData(a)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadFailed)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const inviteLink = useMemo(() => {
    if (!data?.aff_code) return ''
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://you-box.com'
    return `${origin}/signup?aff=${encodeURIComponent(data.aff_code)}`
  }, [data?.aff_code])

  async function onTransfer() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const res = await transferAffiliateQuota()
      setMessage(t.transferred.replace('{amount}', String(res.transferred_quota)))
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.transferFailed)
    } finally {
      setBusy(false)
    }
  }

  async function copyCode() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError(t.copyFailed)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  const invitees = data?.invitees || []

  return (
    <div>
      <h1 className="bx-account-page-title">{t.title}</h1>
      <p className="bx-account-page-sub">
        {data
          ? t.subtitleWithRate.replace('{rate}', String(data.effective_rebate_rate_percent))
          : t.subtitle}
      </p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-[var(--bx-brand-bright)]">{message}</p> : null}

      {data ? (
        <>
          {/* URL hero bar */}
          <div className="bx-account-panel-grad mt-5 flex flex-wrap items-center gap-3 !py-4 !px-5">
            <div className="min-w-0 flex-1">
              <p className="bx-account-mono-label">{t.myLink}</p>
              <p className="mt-1.5 mb-0 truncate font-mono text-sm text-[var(--bx-brand-bright)]">
                {inviteLink || data.aff_code}
              </p>
            </div>
            <button
              type="button"
              className="bx-btn bx-btn-primary bx-btn-sm shrink-0"
              onClick={() => void copyCode()}
            >
              <Copy size={13} />
              {copied ? d.common.copied : t.copyLink}
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="bx-account-panel bx-account-panel-pad">
              <p className="bx-account-mono-label">{t.invitees}</p>
              <p className="bx-account-stat-value">{data.aff_count}</p>
              <p className="bx-account-stat-hint">{t.code}: {data.aff_code}</p>
            </div>
            <div className="bx-account-panel bx-account-panel-pad">
              <p className="bx-account-mono-label">{t.quota}</p>
              <p className="bx-account-stat-value" style={{ color: 'var(--bx-success)' }}>
                {data.aff_quota}
              </p>
              <p className="bx-account-stat-hint">
                {t.history}: {data.aff_history_quota}
              </p>
            </div>
            <div className="bx-account-panel bx-account-panel-pad">
              <p className="bx-account-mono-label">{t.frozen}</p>
              <p className="bx-account-stat-value">{data.aff_frozen_quota}</p>
            </div>
            <div className="bx-account-panel bx-account-panel-pad">
              <p className="bx-account-mono-label">{t.rate}</p>
              <p className="bx-account-stat-value" style={{ color: 'var(--bx-brand-bright)' }}>
                {data.effective_rebate_rate_percent}%
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            <div className="bx-account-table-wrap">
              <p className="m-0 px-5 pb-2.5 pt-3.5 text-[13.5px] font-bold">{t.referrals}</p>
              {invitees.length === 0 ? (
                <p className="bx-account-empty">{t.noReferrals}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="bx-account-table min-w-[480px]">
                    <thead>
                      <tr>
                        <th>{t.colUser}</th>
                        <th>{t.colStatus}</th>
                        <th className="text-right">{t.colSpend}</th>
                        <th className="text-right">{t.colCommission}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitees.map((row, i) => {
                        const rebate = Number(row.total_rebate ?? row.commission ?? 0)
                        const spendRaw = row.total_spend ?? row.spend
                        const hasSpend = spendRaw != null && !Number.isNaN(Number(spendRaw))
                        const paid = rebate > 0
                        const uid = row.user_id ?? row.id
                        return (
                          <tr key={uid ?? i}>
                            <td className="font-mono text-[11.5px] text-[var(--bx-text-soft)]">
                              {row.email ||
                                row.username ||
                                (uid != null ? `user_${uid}` : '—')}
                            </td>
                            <td>
                              <span
                                className={
                                  paid
                                    ? 'bx-account-status bx-account-status--ok'
                                    : 'bx-account-status bx-account-status--warn'
                                }
                              >
                                {paid ? t.referralPaid : t.referralJoined}
                              </span>
                            </td>
                            <td className="num text-right font-mono text-[11.5px] text-[var(--bx-text-muted)]">
                              {hasSpend ? `$${Number(spendRaw).toFixed(2)}` : '—'}
                            </td>
                            <td
                              className="num text-right font-mono text-[11.5px] font-semibold tabular-nums"
                              style={{ color: paid ? 'var(--bx-success)' : 'var(--bx-text-dim)' }}
                            >
                              {rebate > 0 ? `$${rebate.toFixed(2)}` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bx-account-panel bx-account-panel-pad">
              <p className="bx-account-mono-label">{t.withdrawable}</p>
              <p className="bx-account-stat-value bx-account-stat-value--lg">{data.aff_quota}</p>
              <button
                type="button"
                className="bx-btn bx-btn-primary mt-4 w-full"
                disabled={busy || data.aff_quota <= 0}
                onClick={() => void onTransfer()}
              >
                {t.transfer}
              </button>
              <p className="bx-account-stat-hint mt-3 leading-relaxed">
                {t.withdrawHint.replace('{rate}', String(data.effective_rebate_rate_percent))}
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
