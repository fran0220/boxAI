import { useEffect, useState } from 'react'
import { getAffiliate, transferAffiliateQuota, type AffiliateDetail } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

export function AccountAffiliate() {
  const { d } = useI18n()
  const t = d.accountAffiliate
  usePageMeta(t.metaTitle)

  const [data, setData] = useState<AffiliateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

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

      {data ? (
        <div className="bx-card mt-6 space-y-3 p-5 text-sm">
          <Row label={t.code} value={data.aff_code} mono />
          <Row label={t.invitees} value={String(data.aff_count)} />
          <Row label={t.quota} value={String(data.aff_quota)} />
          <Row label={t.frozen} value={String(data.aff_frozen_quota)} />
          <Row label={t.history} value={String(data.aff_history_quota)} />
          <Row label={t.rate} value={`${data.effective_rebate_rate_percent}%`} />
          <button
            type="button"
            className="bx-btn bx-btn-primary bx-btn-sm mt-2"
            disabled={busy || data.aff_quota <= 0}
            onClick={() => void onTransfer()}
          >
            {t.transfer}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[var(--bx-text-muted)]">{label}</span>
      <span className={mono ? 'font-mono' : 'font-medium'}>{value}</span>
    </div>
  )
}
