import { useCallback, useEffect, useState } from 'react'
import { Copy, Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  createKey,
  deleteKey,
  listAvailableGroups,
  listKeys,
  updateKey,
  type ApiKey,
  type ApiKeyGroup,
} from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

export function AccountKeys() {
  const { d } = useI18n()
  const t = d.accountKeys
  usePageMeta(t.metaTitle)

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [groups, setGroups] = useState<ApiKeyGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, g] = await Promise.all([
        listKeys(1, 50, search ? { search } : undefined),
        listAvailableGroups().catch(() => [] as ApiKeyGroup[]),
      ])
      setKeys(list.items || [])
      setGroups(g || [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [search, t.loadFailed])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setError('')
    try {
      const key = await createKey({
        name: name.trim(),
        group_id: groupId ? Number(groupId) : null,
      })
      setCreatedSecret(key.key)
      setName('')
      setGroupId('')
      setShowCreate(false)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.createFailed)
    } finally {
      setCreating(false)
    }
  }

  async function onToggle(key: ApiKey) {
    const next = key.status === 'active' ? 'inactive' : 'active'
    try {
      await updateKey(key.id, { status: next })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.updateFailed)
    }
  }

  async function onDelete(key: ApiKey) {
    if (!window.confirm(t.confirmDelete.replace('{name}', key.name))) return
    try {
      await deleteKey(key.id)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.deleteFailed)
    }
  }

  async function copyKey(key: ApiKey) {
    try {
      await navigator.clipboard.writeText(key.key)
      setCopiedId(key.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      setError(t.copyFailed)
    }
  }

  function mask(key: string): string {
    if (!key || key.length < 12) return '••••••••'
    return `${key.slice(0, 6)}…${key.slice(-4)}`
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="bx-display text-2xl font-bold tracking-tight">{t.title}</h2>
          <p className="mt-1 text-sm text-[var(--bx-text-muted)]">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button type="button" className="bx-btn bx-btn-primary bx-btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            {t.create}
          </button>
        </div>
      </div>

      <div className="mt-4">
        <input
          className="bx-input w-full max-w-xs"
          placeholder={t.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {createdSecret ? (
        <div className="bx-card mt-4 border border-[var(--bx-brand)]/30 p-4 text-sm">
          <p className="font-medium text-[var(--bx-brand-bright)]">{t.secretOnce}</p>
          <code className="mt-2 block break-all rounded bg-[var(--bx-bg-muted)] p-2 font-mono text-xs">{createdSecret}</code>
          <button
            type="button"
            className="bx-btn bx-btn-ghost bx-btn-sm mt-2"
            onClick={() => {
              void navigator.clipboard.writeText(createdSecret)
              setCreatedSecret(null)
            }}
          >
            <Copy size={14} />
            {d.common.copy}
          </button>
        </div>
      ) : null}

      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}

      {showCreate ? (
        <form onSubmit={onCreate} className="bx-card mt-4 space-y-3 p-4">
          <h3 className="font-semibold">{t.createTitle}</h3>
          <label className="block text-sm">
            <span className="text-[var(--bx-text-muted)]">{t.name}</span>
            <input className="bx-input mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--bx-text-muted)]">{t.group}</span>
            <select className="bx-input mt-1 w-full" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">{t.groupDefault}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className="bx-btn bx-btn-primary bx-btn-sm" disabled={creating}>
              {creating ? d.common.loading : t.create}
            </button>
            <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" onClick={() => setShowCreate(false)}>
              {d.common.cancel}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        {loading && keys.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : keys.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--bx-text-dim)]">{t.empty}</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--bx-border)] text-xs text-[var(--bx-text-dim)]">
              <tr>
                <th className="pb-2 pr-3 font-medium">{t.colName}</th>
                <th className="pb-2 pr-3 font-medium">{t.colKey}</th>
                <th className="pb-2 pr-3 font-medium">{t.colGroup}</th>
                <th className="pb-2 pr-3 font-medium">{t.colStatus}</th>
                <th className="pb-2 font-medium">{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-[var(--bx-border)]/60">
                  <td className="py-3 pr-3 font-medium">{key.name}</td>
                  <td className="py-3 pr-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--bx-text-soft)] hover:text-[var(--bx-text)]"
                      onClick={() => void copyKey(key)}
                      title={t.copy}
                    >
                      {mask(key.key)}
                      <Copy size={12} />
                      {copiedId === key.id ? <span className="text-[var(--bx-brand-bright)]">{d.common.copied}</span> : null}
                    </button>
                  </td>
                  <td className="py-3 pr-3 text-[var(--bx-text-muted)]">{key.group?.name || '—'}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={
                        key.status === 'active'
                          ? 'text-[var(--bx-brand-bright)]'
                          : 'text-[var(--bx-text-dim)]'
                      }
                    >
                      {key.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" onClick={() => void onToggle(key)}>
                        {key.status === 'active' ? t.disable : t.enable}
                      </button>
                      <button
                        type="button"
                        className="bx-btn bx-btn-ghost bx-btn-sm text-red-400"
                        onClick={() => void onDelete(key)}
                        aria-label={d.common.delete}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
