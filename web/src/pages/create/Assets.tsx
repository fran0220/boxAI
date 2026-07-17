import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clapperboard,
  Download,
  FolderOpen,
  ImagePlus,
  Play,
  Search,
  Star,
  Trash2,
} from 'lucide-react'
import {
  listAssets,
  removeAsset,
  updateAsset,
  type AssetKind,
  type AssetRecord,
} from '@/lib/assets-db'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { Modal } from '@/components/ui/Modal'

type Filter = 'all' | AssetKind | 'favorites'

export function Assets() {
  const { d } = useI18n()
  const navigate = useNavigate()

  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [focus, setFocus] = useState<AssetRecord | null>(null)

  useEffect(() => {
    void listAssets().then(setAssets)
  }, [])

  const items = useMemo(() => {
    let list = assets
    if (filter === 'favorites') list = list.filter((a) => a.favorite)
    else if (filter !== 'all') list = list.filter((a) => a.kind === filter)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || (a.prompt || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [assets, filter, query])

  async function toggleFavorite(asset: AssetRecord) {
    const updated = await updateAsset(asset.id, { favorite: !asset.favorite })
    if (!updated) return
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? updated : a)))
    setFocus((prev) => (prev?.id === asset.id ? updated : prev))
  }

  async function onDelete(asset: AssetRecord) {
    if (!window.confirm(d.create.assets.deleteConfirm)) return
    await removeAsset(asset.id)
    setAssets((prev) => prev.filter((a) => a.id !== asset.id))
    if (focus?.id === asset.id) setFocus(null)
  }

  function useAsReference(asset: AssetRecord) {
    navigate('/create/image', { state: { reference: asset.payload } })
  }

  function makeVideo(asset: AssetRecord) {
    navigate('/create/video', {
      state: { frame: asset.payload, prompt: asset.prompt || asset.title },
    })
  }

  const filters: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: d.create.assets.filterAll },
    { key: 'image', label: d.create.assets.filterImage },
    { key: 'video', label: d.create.assets.filterVideo },
    { key: 'favorites', label: d.create.assets.filterFavorites },
  ]

  return (
    <div className="bx-create-scroll flex-1">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="bx-create-panel-title">
              <span className="bx-icon-box !h-9 !w-9">
                <FolderOpen size={16} />
              </span>
              {d.create.assets.title}
            </h1>
            <p className="mt-1.5 text-xs text-[var(--bx-text-dim)]">{d.create.assets.subtitle}</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--bx-text-dim)]"
            />
            <input
              className="bx-input !py-2 !pl-9 text-sm"
              placeholder={d.create.assets.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              data-active={filter === f.key}
              className="bx-filter-chip"
            >
              {f.label}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="bx-empty-state mt-6">
            <span className="bx-icon-box">
              <FolderOpen size={20} />
            </span>
            <strong>{d.create.assets.empty}</strong>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((asset) => (
              <div
                key={asset.id}
                className="bx-create-panel bx-card-hover group relative overflow-hidden"
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => setFocus(asset)}
                >
                  {asset.kind === 'image' ? (
                    <img
                      src={asset.payload}
                      alt=""
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="relative flex aspect-square w-full items-center justify-center bg-[var(--bx-bg-muted)]">
                      <video
                        src={asset.payload}
                        preload="metadata"
                        muted
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <span className="bx-media-overlay relative h-11 w-11">
                        <Play size={16} fill="currentColor" />
                      </span>
                    </div>
                  )}
                  <div className="p-3">
                    <p className="truncate text-sm font-medium" title={asset.title}>
                      {asset.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--bx-text-dim)]">
                      {new Date(asset.createdAt).toLocaleString()}
                      {asset.model ? ` · ${asset.model}` : ''}
                    </p>
                  </div>
                </button>
                <div className="absolute right-2 top-2 flex gap-1">
                  <button
                    type="button"
                    className={cx(
                      'rounded-[var(--bx-radius-sm)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)]/90 p-1.5 backdrop-blur transition-opacity',
                      asset.favorite
                        ? 'text-[var(--bx-brand-bright)]'
                        : 'text-[var(--bx-text-dim)] opacity-0 hover:text-[var(--bx-brand-bright)] group-hover:opacity-100',
                    )}
                    onClick={() => void toggleFavorite(asset)}
                    aria-label={
                      asset.favorite ? d.create.actions.unfavorite : d.create.actions.favorite
                    }
                  >
                    <Star size={13} className={asset.favorite ? 'fill-current' : undefined} />
                  </button>
                  <button
                    type="button"
                    className="bx-icon-btn bx-icon-btn--danger border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)]/90 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                    onClick={() => void onDelete(asset)}
                    aria-label={d.common.delete}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!focus} onClose={() => setFocus(null)} title={focus?.title} wide>
        {focus ? (
          <div className="space-y-4">
            {focus.kind === 'image' ? (
              <img
                src={focus.payload}
                alt=""
                className="mx-auto max-h-[58vh] rounded-[var(--bx-radius-md)]"
              />
            ) : (
              <video
                src={focus.payload}
                controls
                autoPlay
                className="mx-auto max-h-[58vh] w-full rounded-[var(--bx-radius-md)]"
              />
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {focus.kind === 'image' ? (
                <>
                  <button
                    type="button"
                    className="bx-btn bx-btn-ghost bx-btn-sm"
                    onClick={() => useAsReference(focus)}
                  >
                    <ImagePlus size={13} />
                    {d.create.actions.useAsReference}
                  </button>
                  <button
                    type="button"
                    className="bx-btn bx-btn-ghost bx-btn-sm"
                    onClick={() => makeVideo(focus)}
                  >
                    <Clapperboard size={13} />
                    {d.create.actions.makeVideo}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="bx-btn bx-btn-ghost bx-btn-sm"
                onClick={() => void toggleFavorite(focus)}
              >
                <Star
                  size={13}
                  className={
                    focus.favorite
                      ? 'fill-[var(--bx-brand-bright)] text-[var(--bx-brand-bright)]'
                      : undefined
                  }
                />
                {focus.favorite ? d.create.actions.unfavorite : d.create.actions.favorite}
              </button>
              <a
                href={focus.payload}
                download
                target="_blank"
                rel="noopener"
                className="bx-btn bx-btn-ghost bx-btn-sm"
              >
                <Download size={13} />
                {d.create.actions.download}
              </a>
              <button
                type="button"
                className="bx-btn bx-btn-danger bx-btn-sm"
                onClick={() => void onDelete(focus)}
              >
                <Trash2 size={13} />
                {d.create.actions.delete}
              </button>
            </div>
            <p className="text-center text-xs text-[var(--bx-text-dim)]">
              {focus.model || ''}
              {focus.meta?.size ? ` · ${String(focus.meta.size)}` : ''} ·{' '}
              {new Date(focus.createdAt).toLocaleString()}
            </p>
            {focus.prompt ? (
              <p className="mx-auto max-w-xl text-center text-xs leading-relaxed text-[var(--bx-text-muted)]">
                {focus.prompt}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
