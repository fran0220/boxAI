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

type FormState = {
  name: string
  groupId: string
  customKey: string
  ipWhitelist: string
  ipBlacklist: string
  enableQuota: boolean
  quota: string
  enableRateLimit: boolean
  rateLimit5h: string
  rateLimit1d: string
  rateLimit7d: string
  expiresInDays: string
  resetQuota: boolean
  resetRateUsage: boolean
}

const emptyForm = (): FormState => ({
  name: '',
  groupId: '',
  customKey: '',
  ipWhitelist: '',
  ipBlacklist: '',
  enableQuota: false,
  quota: '',
  enableRateLimit: false,
  rateLimit5h: '',
  rateLimit1d: '',
  rateLimit7d: '',
  expiresInDays: '0',
  resetQuota: false,
  resetRateUsage: false,
})

function parseIpLines(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function AccountKeys() {
  const { d } = useI18n()
  const t = d.accountKeys
  usePageMeta(t.metaTitle)

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [groups, setGroups] = useState<ApiKeyGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ApiKey | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, g] = await Promise.all([
        listKeys(page, 20, {
          search: search || undefined,
          status: statusFilter || undefined,
        }),
        listAvailableGroups().catch(() => [] as ApiKeyGroup[]),
      ])
      setKeys(list.items || [])
      setPages(list.pages || 1)
      setGroups(g || [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, t.loadFailed])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  function openEdit(key: ApiKey) {
    setEditing(key)
    setForm({
      name: key.name,
      groupId: key.group_id != null ? String(key.group_id) : '',
      customKey: '',
      ipWhitelist: (key.ip_whitelist || []).join('\n'),
      ipBlacklist: (key.ip_blacklist || []).join('\n'),
      enableQuota: (key.quota || 0) > 0,
      quota: key.quota > 0 ? String(key.quota) : '',
      enableRateLimit:
        (key.rate_limit_5h || 0) > 0 || (key.rate_limit_1d || 0) > 0 || (key.rate_limit_7d || 0) > 0,
      rateLimit5h: key.rate_limit_5h ? String(key.rate_limit_5h) : '',
      rateLimit1d: key.rate_limit_1d ? String(key.rate_limit_1d) : '',
      rateLimit7d: key.rate_limit_7d ? String(key.rate_limit_7d) : '',
      expiresInDays: '0',
      resetQuota: false,
      resetRateUsage: false,
    })
    setShowForm(true)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      const ipWhitelist = parseIpLines(form.ipWhitelist)
      const ipBlacklist = parseIpLines(form.ipBlacklist)
      const quota = form.enableQuota && form.quota ? Number(form.quota) : 0
      const ratePayload = form.enableRateLimit
        ? {
            rate_limit_5h: form.rateLimit5h ? Number(form.rateLimit5h) : 0,
            rate_limit_1d: form.rateLimit1d ? Number(form.rateLimit1d) : 0,
            rate_limit_7d: form.rateLimit7d ? Number(form.rateLimit7d) : 0,
          }
        : { rate_limit_5h: 0, rate_limit_1d: 0, rate_limit_7d: 0 }

      if (editing) {
        const days = Number(form.expiresInDays)
        let expires_at: string | null | undefined
        if (days > 0) {
          const d = new Date()
          d.setDate(d.getDate() + days)
          expires_at = d.toISOString()
        }
        await updateKey(editing.id, {
          name: form.name.trim(),
          group_id: form.groupId ? Number(form.groupId) : null,
          ip_whitelist: ipWhitelist,
          ip_blacklist: ipBlacklist,
          quota: form.enableQuota ? quota : 0,
          reset_quota: form.resetQuota || undefined,
          ...ratePayload,
          reset_rate_limit_usage: form.resetRateUsage || undefined,
          ...(expires_at ? { expires_at } : {}),
        })
      } else {
        const days = Number(form.expiresInDays)
        const key = await createKey({
          name: form.name.trim(),
          group_id: form.groupId ? Number(form.groupId) : null,
          custom_key: form.customKey.trim() || undefined,
          ip_whitelist: ipWhitelist.length ? ipWhitelist : undefined,
          ip_blacklist: ipBlacklist.length ? ipBlacklist : undefined,
          quota: form.enableQuota && quota > 0 ? quota : undefined,
          expires_in_days: days > 0 ? days : undefined,
          ...ratePayload,
        })
        setCreatedSecret(key.key)
      }
      setShowForm(false)
      setEditing(null)
      setForm(emptyForm())
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : editing ? t.updateFailed : t.createFailed)
    } finally {
      setSaving(false)
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

  function statusLabel(status: string): string {
    switch (status) {
      case 'active':
        return t.statusActive
      case 'inactive':
        return t.statusInactive
      case 'quota_exhausted':
        return t.statusQuotaExhausted
      case 'expired':
        return t.statusExpired
      default:
        return status
    }
  }

  function statusTone(status: string): string {
    switch (status) {
      case 'active':
        return 'bx-account-status bx-account-status--ok'
      case 'quota_exhausted':
      case 'expired':
        return 'bx-account-status bx-account-status--warn'
      case 'inactive':
        return 'bx-account-status bx-account-status--muted'
      default:
        return 'bx-account-status bx-account-status--muted'
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="bx-account-page-title">{t.title}</h1>
        <div className="bx-account-toolbar">
          <input
            className="bx-account-input-sm w-[220px] max-w-full"
            placeholder={t.search}
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
          />
          <select
            className="bx-account-input-sm"
            value={statusFilter}
            onChange={(e) => {
              setPage(1)
              setStatusFilter(e.target.value)
            }}
            aria-label={t.filterStatus}
          >
            <option value="">{t.filterAll}</option>
            <option value="active">{t.statusActive}</option>
            <option value="inactive">{t.statusInactive}</option>
            <option value="quota_exhausted">{t.statusQuotaExhausted}</option>
            <option value="expired">{t.statusExpired}</option>
          </select>
          <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button type="button" className="bx-btn bx-btn-primary bx-btn-sm" onClick={openCreate}>
            <Plus size={13} />
            {t.create}
          </button>
        </div>
      </div>

      {createdSecret ? (
        <div className="bx-account-panel bx-account-panel-pad mt-4 border-[var(--bx-brand)]/30 text-sm">
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

      {showForm ? (
        <form onSubmit={onSubmit} className="bx-account-panel bx-account-panel-pad mt-4 space-y-3">
          <h3 className="font-semibold">{editing ? t.editTitle : t.createTitle}</h3>
          <label className="block text-sm">
            <span className="text-[var(--bx-text-muted)]">{t.name}</span>
            <input
              className="bx-input mt-1 w-full"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--bx-text-muted)]">{t.group}</span>
            <select
              className="bx-input mt-1 w-full"
              value={form.groupId}
              onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
            >
              <option value="">{t.groupDefault}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          {!editing ? (
            <label className="block text-sm">
              <span className="text-[var(--bx-text-muted)]">{t.customKey}</span>
              <input
                className="bx-input mt-1 w-full font-mono text-xs"
                value={form.customKey}
                onChange={(e) => setForm((f) => ({ ...f, customKey: e.target.value }))}
              />
              <span className="mt-1 block text-xs text-[var(--bx-text-dim)]">{t.customKeyHint}</span>
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="text-[var(--bx-text-muted)]">{t.ipWhitelist}</span>
            <textarea
              className="bx-input mt-1 w-full font-mono text-xs"
              rows={2}
              value={form.ipWhitelist}
              onChange={(e) => setForm((f) => ({ ...f, ipWhitelist: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--bx-text-muted)]">{t.ipBlacklist}</span>
            <textarea
              className="bx-input mt-1 w-full font-mono text-xs"
              rows={2}
              value={form.ipBlacklist}
              onChange={(e) => setForm((f) => ({ ...f, ipBlacklist: e.target.value }))}
            />
            <span className="mt-1 block text-xs text-[var(--bx-text-dim)]">{t.ipHint}</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enableQuota}
              onChange={(e) => setForm((f) => ({ ...f, enableQuota: e.target.checked }))}
            />
            {t.enableQuota}
          </label>
          {form.enableQuota ? (
            <label className="block text-sm">
              <span className="text-[var(--bx-text-muted)]">{t.quotaLimit}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="bx-input mt-1 w-full"
                value={form.quota}
                onChange={(e) => setForm((f) => ({ ...f, quota: e.target.value }))}
              />
            </label>
          ) : null}
          {editing && (editing.quota || 0) > 0 ? (
            <p className="text-xs text-[var(--bx-text-dim)]">
              {t.quotaUsed}: ${editing.quota_used?.toFixed(4) ?? '0'} / ${editing.quota?.toFixed(2)}
            </p>
          ) : null}
          {editing ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.resetQuota}
                onChange={(e) => setForm((f) => ({ ...f, resetQuota: e.target.checked }))}
              />
              {t.resetQuota}
            </label>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enableRateLimit}
              onChange={(e) => setForm((f) => ({ ...f, enableRateLimit: e.target.checked }))}
            />
            {t.enableRateLimit}
          </label>
          {form.enableRateLimit ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="text-[var(--bx-text-muted)]">{t.rateLimit5h}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="bx-input mt-1 w-full"
                  value={form.rateLimit5h}
                  onChange={(e) => setForm((f) => ({ ...f, rateLimit5h: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--bx-text-muted)]">{t.rateLimit1d}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="bx-input mt-1 w-full"
                  value={form.rateLimit1d}
                  onChange={(e) => setForm((f) => ({ ...f, rateLimit1d: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--bx-text-muted)]">{t.rateLimit7d}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="bx-input mt-1 w-full"
                  value={form.rateLimit7d}
                  onChange={(e) => setForm((f) => ({ ...f, rateLimit7d: e.target.value }))}
                />
              </label>
            </div>
          ) : null}
          {editing ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.resetRateUsage}
                onChange={(e) => setForm((f) => ({ ...f, resetRateUsage: e.target.checked }))}
              />
              {t.resetRateUsage}
            </label>
          ) : null}

          <label className="block text-sm">
            <span className="text-[var(--bx-text-muted)]">{t.expiresInDays}</span>
            <input
              type="number"
              min={0}
              className="bx-input mt-1 w-full"
              value={form.expiresInDays}
              onChange={(e) => setForm((f) => ({ ...f, expiresInDays: e.target.value }))}
            />
            <span className="mt-1 block text-xs text-[var(--bx-text-dim)]">{t.expiresInDaysHint}</span>
          </label>

          <div className="flex gap-2">
            <button type="submit" className="bx-btn bx-btn-primary bx-btn-sm" disabled={saving}>
              {saving ? d.common.loading : editing ? t.save : t.create}
            </button>
            <button
              type="button"
              className="bx-btn bx-btn-ghost bx-btn-sm"
              onClick={() => {
                setShowForm(false)
                setEditing(null)
              }}
            >
              {d.common.cancel}
            </button>
          </div>
        </form>
      ) : null}

      <div className="bx-account-table-wrap mt-5 overflow-x-auto">
        {loading && keys.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : keys.length === 0 ? (
          <p className="bx-account-empty">{t.empty}</p>
        ) : (
          <table className="bx-account-table bx-account-table--compact min-w-[820px]">
            <thead>
              <tr>
                <th>{t.colName}</th>
                <th>{t.colKey}</th>
                <th>{t.colGroup}</th>
                <th>{t.colQuota}</th>
                <th>{t.colRateLimit}</th>
                <th>{t.colStatus}</th>
                <th className="text-right">{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => {
                const rateBits: string[] = []
                if ((key.rate_limit_5h || 0) > 0) {
                  rateBits.push(`5h $${(key.usage_5h || 0).toFixed(1)}/${key.rate_limit_5h!.toFixed(0)}`)
                }
                if ((key.rate_limit_1d || 0) > 0) {
                  rateBits.push(`1d $${(key.usage_1d || 0).toFixed(1)}/${key.rate_limit_1d!.toFixed(0)}`)
                }
                if ((key.rate_limit_7d || 0) > 0) {
                  rateBits.push(`7d $${(key.usage_7d || 0).toFixed(1)}/${key.rate_limit_7d!.toFixed(0)}`)
                }
                return (
                <tr key={key.id}>
                  <td>
                    <div className="font-bold text-[var(--bx-text)]">{key.name}</div>
                    {key.last_used_at ? (
                      <div className="mt-0.5 font-mono text-[10px] text-[var(--bx-text-dim)]">
                        {t.colLastUsed}: {new Date(key.last_used_at).toLocaleString()}
                      </div>
                    ) : key.expires_at ? (
                      <div className="mt-0.5 font-mono text-[10px] text-[var(--bx-text-dim)]">
                        {t.colExpires}: {new Date(key.expires_at).toLocaleDateString()}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-[var(--bx-text-soft)] hover:text-[var(--bx-brand-bright)]"
                      onClick={() => void copyKey(key)}
                      title={t.copy}
                    >
                      {mask(key.key)}
                      <Copy size={11} />
                      {copiedId === key.id ? <span className="text-[var(--bx-brand-bright)]">{d.common.copied}</span> : null}
                    </button>
                  </td>
                  <td className="text-xs text-[var(--bx-text-muted)]">{key.group?.name || '—'}</td>
                  <td className="num text-[11px]">
                    {(key.quota || 0) > 0 ? (
                      <div className="min-w-[88px]">
                        <span className="font-mono text-[var(--bx-text-soft)]">
                          ${key.quota_used?.toFixed(2) || '0.00'} / ${key.quota.toFixed(2)}
                        </span>
                        <span className="bx-account-progress">
                          <i
                            style={{
                              width: `${Math.min(100, ((key.quota_used || 0) / key.quota) * 100)}%`,
                            }}
                            className={
                              (key.quota_used || 0) / key.quota >= 1
                                ? 'is-danger'
                                : (key.quota_used || 0) / key.quota >= 0.8
                                  ? 'is-warn'
                                  : undefined
                            }
                          />
                        </span>
                      </div>
                    ) : (
                      <span className="text-[var(--bx-text-dim)]">{t.unlimited}</span>
                    )}
                  </td>
                  <td className="font-mono text-[11px] text-[var(--bx-text-muted)]">
                    {rateBits.length ? rateBits.join(' · ') : '—'}
                  </td>
                  <td>
                    <span className={statusTone(key.status)}>{statusLabel(key.status)}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1">
                      <button type="button" className="bx-account-outline-btn" onClick={() => openEdit(key)}>
                        {t.edit}
                      </button>
                      <button type="button" className="bx-account-outline-btn" onClick={() => void onToggle(key)}>
                        {key.status === 'active' ? t.disable : t.enable}
                      </button>
                      <button
                        type="button"
                        className="bx-account-outline-btn bx-account-outline-btn--danger"
                        onClick={() => void onDelete(key)}
                        aria-label={d.common.delete}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>

      <p className="bx-account-foot-meta">
        {t.keysCount.replace('{n}', String(keys.length))} ·{' '}
        {t.page.replace('{page}', String(page)).replace('{pages}', String(pages))}
      </p>
      {pages > 1 ? (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            className="bx-btn bx-btn-ghost bx-btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ←
          </button>
          <button
            type="button"
            className="bx-btn bx-btn-ghost bx-btn-sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  )
}
