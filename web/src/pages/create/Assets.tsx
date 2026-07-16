import { useEffect, useState } from 'react'
import { listAssets, removeAsset, type AssetRecord } from '@/lib/assets-db'

export function Assets() {
  const [items, setItems] = useState<AssetRecord[]>([])
  const [filter, setFilter] = useState<'all' | AssetRecord['kind']>('all')

  async function reload() {
    const all = await listAssets(filter === 'all' ? undefined : filter)
    setItems(all)
  }

  useEffect(() => {
    void reload()
  }, [filter])

  async function onDelete(id: string) {
    await removeAsset(id)
    await reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['all', 'chat', 'image', 'video'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === k
                ? 'bg-[rgba(45,212,191,0.15)] text-[var(--bx-teal)]'
                : 'text-[var(--bx-text-muted)]'
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="bx-card p-8 text-center text-sm text-[var(--bx-text-dim)]">
          No local history yet. Generations are stored in this browser (IndexedDB / localStorage).
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="bx-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  <span className="text-[var(--bx-teal)]">{item.kind}</span> · {item.title}
                </p>
                <p className="text-xs text-[var(--bx-text-dim)]">
                  {new Date(item.createdAt).toLocaleString()}
                  {item.model ? ` · ${item.model}` : ''}
                </p>
                {item.kind === 'image' &&
                (item.payload.startsWith('http') || item.payload.startsWith('data:')) ? (
                  <img src={item.payload} alt="" className="mt-2 max-h-32 rounded-lg object-cover" />
                ) : null}
                {item.kind === 'video' && item.payload ? (
                  <a href={item.payload} className="mt-1 block text-xs text-[var(--bx-cyan)] underline" target="_blank" rel="noopener">
                    Open video
                  </a>
                ) : null}
              </div>
              <button type="button" className="bx-btn bx-btn-ghost !py-1 text-xs" onClick={() => onDelete(item.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
