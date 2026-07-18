import { useEffect, useMemo, useState } from 'react'
import {
  listAvailableChannels,
  type AvailableChannel,
  type UserSupportedModel,
} from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'
import { cx } from '@/lib/cx'

type ModelKind = 'all' | 'chat' | 'image' | 'video' | 'other'

type FlatModelRow = {
  key: string
  model: string
  provider: string
  channelName: string
  kind: Exclude<ModelKind, 'all'>
  inPrice: string
  outPrice: string
  status: 'available'
}

function inferKind(model: string): Exclude<ModelKind, 'all'> {
  const m = model.toLowerCase()
  if (
    /video|kling|runway|luma|sora|veo|minimax.*video|hailuo|wanx.*video|cogvideo/.test(m)
  ) {
    return 'video'
  }
  if (
    /image|flux|sdxl|sd3|dall-?e|ideogram|midjourney|imagen|recraft|stable-diffusion|gpt-image|banana|seedream|nanobanana/.test(
      m,
    )
  ) {
    return 'image'
  }
  if (
    /claude|gpt|o[1-4]|gemini|deepseek|qwen|llama|mistral|command|grok|chat|sonnet|haiku|opus|coder|reason/.test(
      m,
    )
  ) {
    return 'chat'
  }
  return 'other'
}

function formatPerM(price: number | null | undefined): string {
  if (price == null || Number.isNaN(price)) return '—'
  // Backend stores per-token prices for many providers; show per 1M tokens.
  const perM = price < 0.01 ? price * 1_000_000 : price
  if (perM >= 100) return `$${perM.toFixed(0)}`
  if (perM >= 1) return `$${perM.toFixed(2)}`
  if (perM >= 0.01) return `$${perM.toFixed(3)}`
  return `$${perM.toFixed(4)}`
}

function formatPricing(m: UserSupportedModel): { inPrice: string; outPrice: string } {
  const p = m.pricing
  if (!p) return { inPrice: '—', outPrice: '—' }
  const mode = (p.billing_mode || '').toLowerCase()
  if (mode.includes('image') || (p.image_output_price != null && p.input_price == null)) {
    const img = p.image_output_price ?? p.per_request_price
    return {
      inPrice: '—',
      outPrice: img != null ? `$${Number(img).toFixed(4)}` : '—',
    }
  }
  if (p.per_request_price != null && p.input_price == null && p.output_price == null) {
    return { inPrice: '—', outPrice: `$${Number(p.per_request_price).toFixed(4)}` }
  }
  return {
    inPrice: formatPerM(p.input_price),
    outPrice: formatPerM(p.output_price),
  }
}

function flattenChannels(list: AvailableChannel[]): FlatModelRow[] {
  const rows: FlatModelRow[] = []
  const seen = new Set<string>()

  for (const ch of list) {
    const channelName = ch.name || ch.group_name || ''
    if (Array.isArray(ch.platforms) && ch.platforms.length > 0) {
      for (const section of ch.platforms) {
        const provider = section.platform || ch.platform || '—'
        const models = section.supported_models || []
        for (const m of models) {
          if (!m?.name) continue
          const key = `${m.name}::${provider}`
          if (seen.has(key)) continue
          seen.add(key)
          const { inPrice, outPrice } = formatPricing(m)
          rows.push({
            key,
            model: m.name,
            provider: m.platform || provider,
            channelName,
            kind: inferKind(m.name),
            inPrice,
            outPrice,
            status: 'available',
          })
        }
      }
      continue
    }

    // Legacy flat: name + models[]
    const provider = ch.platform ? String(ch.platform) : '—'
    const models = Array.isArray(ch.models) ? ch.models : []
    if (models.length === 0) {
      const name = channelName || '—'
      const key = `ch::${name}::${provider}`
      if (!seen.has(key)) {
        seen.add(key)
        rows.push({
          key,
          model: name,
          provider,
          channelName: name,
          kind: inferKind(name),
          inPrice: '—',
          outPrice: '—',
          status: 'available',
        })
      }
      continue
    }
    for (const model of models) {
      const name = String(model)
      const key = `${name}::${provider}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({
        key,
        model: name,
        provider,
        channelName,
        kind: inferKind(name),
        inPrice: '—',
        outPrice: '—',
        status: 'available',
      })
    }
  }

  return rows.sort((a, b) => a.model.localeCompare(b.model))
}

export function AccountChannels() {
  const { d } = useI18n()
  const t = d.accountChannels
  usePageMeta(t.metaTitle)

  const [items, setItems] = useState<AvailableChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<ModelKind>('all')

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

  const flat = useMemo(() => flattenChannels(items), [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return flat.filter((row) => {
      if (kind !== 'all' && row.kind !== kind) return false
      if (!q) return true
      return (
        row.model.toLowerCase().includes(q) ||
        row.provider.toLowerCase().includes(q) ||
        row.channelName.toLowerCase().includes(q)
      )
    })
  }, [flat, search, kind])

  const chips: Array<{ id: ModelKind; label: string }> = [
    { id: 'all', label: t.filterAll },
    { id: 'chat', label: t.filterChat },
    { id: 'image', label: t.filterImage },
    { id: 'video', label: t.filterVideo },
  ]

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="bx-account-page-title">{t.title}</h1>
          <p className="bx-account-page-sub">{t.subtitle}</p>
        </div>
        <input
          className="bx-account-input-sm w-[220px] max-w-full"
          placeholder={t.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t.search}
        />
      </div>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

      <div className="mt-4.5 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            className={cx('bx-account-chip', kind === c.id && 'is-active')}
            onClick={() => setKind(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bx-account-panel mt-3.5">
          <p className="bx-account-empty">{t.empty}</p>
        </div>
      ) : (
        <div className="bx-account-table-wrap mt-3.5 overflow-x-auto">
          <table className="bx-account-table min-w-[720px]">
            <thead>
              <tr>
                <th>{t.colModel}</th>
                <th>{t.colProvider}</th>
                <th>{t.colType}</th>
                <th className="text-right">{t.colInPrice}</th>
                <th className="text-right">{t.colOutPrice}</th>
                <th>{t.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const initial = (row.provider || row.model || '?').charAt(0).toUpperCase()
                const kindLabel =
                  row.kind === 'chat'
                    ? t.filterChat
                    : row.kind === 'image'
                      ? t.filterImage
                      : row.kind === 'video'
                        ? t.filterVideo
                        : t.filterOther
                return (
                  <tr key={row.key}>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <span
                          className={cx(
                            'bx-account-model-icon',
                            row.kind === 'image' && 'bx-account-model-icon--image',
                            row.kind === 'video' && 'bx-account-model-icon--video',
                          )}
                        >
                          {initial}
                        </span>
                        <span className="font-mono text-xs font-semibold text-[var(--bx-text-soft)]">
                          {row.model}
                        </span>
                      </span>
                    </td>
                    <td className="text-[var(--bx-text-muted)]">{row.provider}</td>
                    <td>
                      <span
                        className={cx(
                          'bx-account-type-badge',
                          row.kind === 'chat' && 'bx-account-type-badge--chat',
                          row.kind === 'image' && 'bx-account-type-badge--image',
                          row.kind === 'video' && 'bx-account-type-badge--video',
                          row.kind === 'other' && 'bx-account-type-badge--other',
                        )}
                      >
                        {kindLabel}
                      </span>
                    </td>
                    <td className="num text-right font-mono text-[11.5px]">{row.inPrice}</td>
                    <td className="num text-right font-mono text-[11.5px]">{row.outPrice}</td>
                    <td>
                      <span className="bx-account-status bx-account-status--ok">{t.statusAvailable}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="bx-account-foot-meta">
        {t.modelCount.replace('{n}', String(filtered.length))}
      </p>
    </div>
  )
}
