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
    <div className="bx-create-scroll">
      <div className="bx-create-page">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="bx-create-panel-title bx-create-panel-title--lg">
              {d.create.assets.title}
            </h1>
            <p className="mt-1 text-[12.5px] text-[var(--bx-text-muted)]">
              {d.create.assets.subtitle}
            </p>
          </div>
          <div className="bx-create-filter-row">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                data-active={filter === f.key}
                className="bx-create-filter-chip"
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-4 max-w-sm">
          <Search
            size={13}
            className="absolute left-[11px] top-1/2 -translate-y-1/2 text-[var(--bx-text-dim)]"
          />
          <input
            className="bx-input !rounded-[7px] !py-[6.5px] !pl-8 text-[12.5px]"
            placeholder={d.create.assets.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {items.length === 0 ? (
          <div className="bx-empty-state mt-[18px]">
            <span className="bx-icon-box">
              <FolderOpen size={20} />
            </span>
            <strong>{d.create.assets.empty}</strong>
          </div>
        ) : (
          <div className="bx-create-assets-grid mt-[18px]">
            {items.map((asset) => (
              <div key={asset.id} className="bx-create-asset-tile group">
                <button
                  type="button"
                  className="absolute inset-0 block w-full text-left"
                  onClick={() => setFocus(asset)}
                >
                  {asset.kind === 'image' ? (
                    <img
                      src={asset.payload}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="relative flex h-full w-full items-center justify-center bg-[var(--bx-bg-muted)]">
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
                </button>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1.5 bg-gradient-to-t from-[rgba(2,4,5,0.75)] to-transparent px-2.5 py-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="min-w-0 truncate font-mono text-[9.5px] text-white/85">
                    {asset.model || asset.title}
                  </span>
                  <span className="pointer-events-auto flex gap-1 text-white/90">
                    <button
                      type="button"
                      className={cx(
                        'rounded p-0.5',
                        asset.favorite ? 'text-[var(--bx-brand-bright)]' : '',
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        void toggleFavorite(asset)
                      }}
                      aria-label={
                        asset.favorite ? d.create.actions.unfavorite : d.create.actions.favorite
                      }
                    >
                      <Star size={12} className={asset.favorite ? 'fill-current' : undefined} />
                    </button>
                    <button
                      type="button"
                      className="rounded p-0.5 text-white/70 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        void onDelete(asset)
                      }}
                      aria-label={d.common.delete}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
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
