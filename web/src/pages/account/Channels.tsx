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
      <h1 className="bx-account-page-title">{t.title}</h1>
      <p className="bx-account-page-sub">{t.subtitle}</p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

      {items.length === 0 ? (
        <div className="bx-account-panel mt-5">
          <p className="bx-account-empty">{t.empty}</p>
        </div>
      ) : (
        <div className="bx-account-table-wrap mt-5 overflow-x-auto">
          <table className="bx-account-table min-w-[560px]">
            <thead>
              <tr>
                <th>{t.colName}</th>
                <th>{t.colPlatform}</th>
                <th>{t.colModels}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ch, i) => {
                const name = (ch.name as string) || (ch.group_name as string) || t.unnamed
                const platform = ch.platform ? String(ch.platform) : '—'
                const models = Array.isArray(ch.models) ? ch.models : []
                return (
                  <tr key={(ch.id as number) ?? i}>
                    <td className="font-bold text-[var(--bx-text)]">{name}</td>
                    <td className="text-[var(--bx-text-muted)]">{platform}</td>
                    <td className="font-mono text-[11.5px] text-[var(--bx-text-soft)]">
                      {models.length
                        ? `${models.slice(0, 8).join(', ')}${models.length > 8 ? '…' : ''}`
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
