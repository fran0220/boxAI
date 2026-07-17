import { useEffect, useState } from 'react'
import { listAvailableChannels, type AvailableChannel } from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

export function AccountChannels() {
  const { d } = useI18n()
  const t = d.accountChannels
  usePageMeta(t.metaTitle)

  const [items, setItems] = useState<AvailableChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listAvailableChannels()
        if (!cancelled) setItems(Array.isArray(list) ? list : [])
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <h2 className="bx-display text-2xl font-bold tracking-tight">{t.title}</h2>
      <p className="mt-1 text-sm text-[var(--bx-text-muted)]">{t.subtitle}</p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[var(--bx-text-dim)]">{t.empty}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((ch, i) => (
            <li key={(ch.id as number) ?? i} className="bx-card p-4">
              <p className="font-semibold">{(ch.name as string) || (ch.group_name as string) || t.unnamed}</p>
              <p className="mt-1 text-xs text-[var(--bx-text-dim)]">
                {ch.platform ? String(ch.platform) : ''}
                {Array.isArray(ch.models) && ch.models.length
                  ? ` · ${ch.models.slice(0, 8).join(', ')}${ch.models.length > 8 ? '…' : ''}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
