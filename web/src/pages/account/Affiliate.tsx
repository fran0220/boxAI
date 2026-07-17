import { useEffect, useState } from 'react'
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
    if (!data?.aff_code) return
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://you-box.com'
      const link = `${origin}/signup?aff=${encodeURIComponent(data.aff_code)}`
      await navigator.clipboard.writeText(link)
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

  return (
    <div>
      <h1 className="bx-account-page-title">{t.title}</h1>
      <p className="bx-account-page-sub">{t.subtitle}</p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-[var(--bx-brand-bright)]">{message}</p> : null}

      {data ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="bx-account-panel bx-account-panel-pad">
              <p className="bx-account-mono-label">{t.invitees}</p>
              <p className="bx-account-stat-value">{data.aff_count}</p>
            </div>
            <div className="bx-account-panel bx-account-panel-pad">
              <p className="bx-account-mono-label">{t.quota}</p>
              <p className="bx-account-stat-value">{data.aff_quota}</p>
            </div>
            <div className="bx-account-panel bx-account-panel-pad">
              <p className="bx-account-mono-label">{t.frozen}</p>
              <p className="bx-account-stat-value">{data.aff_frozen_quota}</p>
            </div>
            <div className="bx-account-panel bx-account-panel-pad">
              <p className="bx-account-mono-label">{t.rate}</p>
              <p className="bx-account-stat-value">{data.effective_rebate_rate_percent}%</p>
            </div>
          </div>

          <div className="bx-account-panel bx-account-panel-pad mt-3">
            <p className="bx-account-mono-label">{t.code}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded-[6px] bg-[var(--bx-bg-muted)] px-3 py-2 font-mono text-sm">
                {data.aff_code}
              </code>
              <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" onClick={() => void copyCode()}>
                <Copy size={13} />
                {copied ? d.common.copied : t.copyLink}
              </button>
            </div>
            <p className="bx-account-stat-hint mt-2">
              {t.history}: {data.aff_history_quota}
            </p>
            <button
              type="button"
              className="bx-btn bx-btn-primary bx-btn-sm mt-4"
              disabled={busy || data.aff_quota <= 0}
              onClick={() => void onTransfer()}
            >
              {t.transfer}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
