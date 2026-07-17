import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  cancelBatchImageJob,
  deleteBatchImageJobRecord,
  downloadBatchImageZip,
  listBatchImageItems,
  listBatchImageJobs,
  listBatchImageModels,
  saveBlob,
  submitBatchImageJob,
  type BatchImageItem,
  type BatchImageJob,
  type BatchImageModel,
  type BatchImageStatus,
} from '@/lib/customer-api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

const API_KEY_STORAGE = 'boxai_batch_image_api_key'
const IMAGE_SIZES = ['1K', '2K', '4K'] as const
const ASPECT_RATIOS = ['', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] as const

const ACTIVE_STATUSES = new Set<string>([
  'queued',
  'running',
  'indexing',
  'processing_results',
  'settling',
])

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function readStoredKey(): string {
  try {
    return sessionStorage.getItem(API_KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

function writeStoredKey(key: string) {
  try {
    if (key) sessionStorage.setItem(API_KEY_STORAGE, key)
    else sessionStorage.removeItem(API_KEY_STORAGE)
  } catch {
    /* ignore */
  }
}

function formatTs(ts: number | null | undefined): string {
  if (ts == null || ts <= 0) return '—'
  // Gateway may return unix seconds or ms
  const ms = ts < 1e12 ? ts * 1000 : ts
  try {
    return new Date(ms).toLocaleString()
  } catch {
    return '—'
  }
}

function formatCost(job: BatchImageJob): string {
  const value = job.actual_cost != null ? job.actual_cost : job.estimated_cost
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `$${Number(value).toFixed(4)}`
}

function canCancel(status: BatchImageStatus): boolean {
  return ACTIVE_STATUSES.has(String(status))
}

function canDownload(job: BatchImageJob): boolean {
  if (job.output_deleted_at) return false
  return job.status === 'completed' && (job.success_count || 0) > 0
}

function canDelete(_job: BatchImageJob): boolean {
  return true
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'completed') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
  if (s === 'failed' || s === 'output_deleted') return 'bg-red-500/15 text-red-700 dark:text-red-300'
  if (s === 'cancelled') return 'bg-[var(--bx-bg-muted)] text-[var(--bx-text-muted)]'
  if (ACTIVE_STATUSES.has(s)) return 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
  return 'bg-[var(--bx-bg-muted)] text-[var(--bx-text-soft)]'
}

export function AccountBatchImage() {
  const { d } = useI18n()
  const t = d.accountBatchImage
  usePageMeta(t.metaTitle)

  const [apiKey, setApiKey] = useState(readStoredKey)
  const [jobs, setJobs] = useState<BatchImageJob[]>([])
  const [models, setModels] = useState<BatchImageModel[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  // Submit form
  const [model, setModel] = useState('')
  const [taskName, setTaskName] = useState('')
  const [imageSize, setImageSize] = useState<(typeof IMAGE_SIZES)[number]>('1K')
  const [aspectRatio, setAspectRatio] = useState<(typeof ASPECT_RATIOS)[number]>('')
  const [prompts, setPrompts] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Items modal
  const [itemsJob, setItemsJob] = useState<BatchImageJob | null>(null)
  const [items, setItems] = useState<BatchImageItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  const keyReady = apiKey.trim().length > 0

  const promptCount = useMemo(
    () =>
      prompts
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean).length,
    [prompts],
  )

  const onApiKeyChange = (value: string) => {
    setApiKey(value)
    writeStoredKey(value.trim())
  }

  const loadModels = useCallback(async (key: string) => {
    if (!key.trim()) {
      setModels([])
      return
    }
    setLoadingModels(true)
    try {
      const res = await listBatchImageModels(key.trim())
      const list = res.data || []
      setModels(list)
      setModel((prev) => {
        if (prev && list.some((m) => m.id === prev)) return prev
        return list[0]?.id || ''
      })
    } catch {
      setModels([])
      setModel('')
    } finally {
      setLoadingModels(false)
    }
  }, [])

  const loadJobs = useCallback(async () => {
    const key = apiKey.trim()
    if (!key) {
      setError(t.selectKey)
      return
    }
    setLoadingJobs(true)
    setError('')
    setSuccess('')
    try {
      const res = await listBatchImageJobs(key, { limit: 50 })
      setJobs(res.data || [])
    } catch (err) {
      setJobs([])
      setError(errMessage(err, t.loadFailed))
    } finally {
      setLoadingJobs(false)
    }
  }, [apiKey, t.loadFailed, t.selectKey])

  useEffect(() => {
    if (!apiKey.trim()) {
      setModels([])
      return
    }
    void loadModels(apiKey)
  }, [apiKey, loadModels])

  async function onCancel(job: BatchImageJob) {
    if (!canCancel(job.status)) return
    if (!window.confirm(t.confirmCancel)) return
    const key = apiKey.trim()
    setBusyId(job.id)
    setError('')
    try {
      await cancelBatchImageJob(key, job.id)
      await loadJobs()
    } catch (err) {
      setError(errMessage(err, t.cancelFailed))
    } finally {
      setBusyId(null)
    }
  }

  async function onDownload(job: BatchImageJob) {
    if (!canDownload(job)) return
    const key = apiKey.trim()
    setBusyId(job.id)
    setError('')
    try {
      const blob = await downloadBatchImageZip(key, job.id)
      const name = (job.task_name || job.id).replace(/[^\w.-]+/g, '_')
      saveBlob(blob, `${name || 'batch'}.zip`)
    } catch (err) {
      setError(errMessage(err, t.downloadFailed))
    } finally {
      setBusyId(null)
    }
  }

  async function onDelete(job: BatchImageJob) {
    if (!window.confirm(t.confirmDelete)) return
    const key = apiKey.trim()
    setBusyId(job.id)
    setError('')
    try {
      await deleteBatchImageJobRecord(key, job.id)
      setJobs((prev) => prev.filter((j) => j.id !== job.id))
      if (itemsJob?.id === job.id) {
        setItemsJob(null)
        setItems([])
      }
    } catch (err) {
      setError(errMessage(err, t.deleteFailed))
    } finally {
      setBusyId(null)
    }
  }

  async function openItems(job: BatchImageJob) {
    const key = apiKey.trim()
    setItemsJob(job)
    setItems([])
    setLoadingItems(true)
    setError('')
    try {
      const res = await listBatchImageItems(key, job.id)
      setItems(res.data || [])
    } catch (err) {
      setError(errMessage(err, t.loadFailed))
    } finally {
      setLoadingItems(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const key = apiKey.trim()
    if (!key) {
      setError(t.selectKey)
      return
    }
    if (!model) {
      setError(t.noModels)
      return
    }
    const lines = prompts
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) {
      setError(t.promptsHint)
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const itemsPayload = lines.map((prompt, i) => ({
        custom_id: `item-${i + 1}`,
        prompt,
      }))
      await submitBatchImageJob(
        key,
        {
          model,
          task_name: taskName.trim() || undefined,
          image_size: imageSize,
          aspect_ratio: aspectRatio || undefined,
          items: itemsPayload,
        },
        crypto.randomUUID(),
      )
      setSuccess(t.submitted)
      setPrompts('')
      setTaskName('')
      await loadJobs()
    } catch (err) {
      setError(errMessage(err, t.submitFailed))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl">
      <h1 className="bx-account-page-title">{t.title}</h1>
      <p className="bx-account-page-sub">{t.subtitle}</p>

      {/* API guide */}
      <section className="bx-card mt-6 p-5">
        <h3 className="text-sm font-semibold text-[var(--bx-text)]">{t.guide}</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--bx-text-soft)]">
          <li>{t.step1}</li>
          <li>{t.step2}</li>
          <li>{t.step3}</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/account/keys" className="bx-btn bx-btn-primary bx-btn-sm">
            {t.openKeys}
          </Link>
          <Link to="/create/image" className="bx-btn bx-btn-ghost bx-btn-sm">
            {t.openCreator}
          </Link>
        </div>
      </section>

      {/* API key */}
      <section className="bx-card mt-4 space-y-3 p-5">
        <div>
          <label className="text-sm font-medium text-[var(--bx-text)]" htmlFor="batch-api-key">
            {t.selectKey}
          </label>
          <p className="mt-0.5 text-xs text-[var(--bx-text-dim)]">{t.selectKeyHint}</p>
          <input
            id="batch-api-key"
            type="password"
            autoComplete="off"
            className="bx-input mt-2 w-full font-mono text-sm"
            placeholder={t.pasteKey}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
          />
          <p className="mt-1 text-xs text-[var(--bx-text-dim)]">{t.useListed}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="bx-btn bx-btn-primary bx-btn-sm"
            disabled={!keyReady || loadingJobs}
            onClick={() => void loadJobs()}
          >
            {loadingJobs ? t.refresh : t.loadJobs}
          </button>
          <button
            type="button"
            className="bx-btn bx-btn-ghost bx-btn-sm"
            disabled={!keyReady || loadingJobs}
            onClick={() => void loadJobs()}
          >
            {t.refresh}
          </button>
        </div>
      </section>

      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{success}</p> : null}

      {/* Submit form */}
      <section className="bx-card mt-4 p-5">
        <h3 className="text-sm font-semibold text-[var(--bx-text)]">{t.submitTitle}</h3>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label className="text-xs font-medium text-[var(--bx-text-dim)]" htmlFor="batch-model">
              {t.model}
            </label>
            <select
              id="batch-model"
              className="bx-input mt-1 w-full"
              value={model}
              disabled={!keyReady || loadingModels || models.length === 0}
              onChange={(e) => setModel(e.target.value)}
            >
              {loadingModels ? (
                <option value="">{t.refresh}…</option>
              ) : models.length === 0 ? (
                <option value="">{t.noModels}</option>
              ) : (
                models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                    {m.provider ? ` · ${m.provider}` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--bx-text-dim)]" htmlFor="batch-task-name">
              {t.taskName}
            </label>
            <input
              id="batch-task-name"
              className="bx-input mt-1 w-full"
              value={taskName}
              maxLength={255}
              onChange={(e) => setTaskName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--bx-text-dim)]" htmlFor="batch-image-size">
              {t.imageSize}
            </label>
            <select
              id="batch-image-size"
              className="bx-input mt-1 w-full"
              value={imageSize}
              onChange={(e) => setImageSize(e.target.value as (typeof IMAGE_SIZES)[number])}
            >
              {IMAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--bx-text-dim)]" htmlFor="batch-aspect">
              {t.aspectRatio}
            </label>
            <select
              id="batch-aspect"
              className="bx-input mt-1 w-full"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as (typeof ASPECT_RATIOS)[number])}
            >
              {ASPECT_RATIOS.map((r) => (
                <option key={r || 'auto'} value={r}>
                  {r || '—'}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-[var(--bx-text-dim)]" htmlFor="batch-prompts">
              {t.prompts}
            </label>
            <p className="mt-0.5 text-xs text-[var(--bx-text-dim)]">{t.promptsHint}</p>
            <textarea
              id="batch-prompts"
              className="bx-input mt-1 min-h-[120px] w-full font-mono text-sm"
              value={prompts}
              onChange={(e) => setPrompts(e.target.value)}
              placeholder="A cat on a windowsill&#10;Sunset over the ocean"
            />
            {promptCount > 0 ? (
              <p className="mt-1 text-xs text-[var(--bx-text-dim)]">{promptCount} items</p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="bx-btn bx-btn-primary bx-btn-sm"
              disabled={!keyReady || submitting || !model || promptCount === 0}
            >
              {submitting ? t.submitting : t.submit}
            </button>
          </div>
        </form>
      </section>

      {/* Jobs table */}
      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--bx-text)]">{t.jobs}</h3>
        </div>

        {loadingJobs ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : jobs.length === 0 ? (
          <p className="mt-8 text-center text-sm text-[var(--bx-text-dim)]">{t.empty}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-[var(--bx-border)] text-xs text-[var(--bx-text-dim)]">
                <tr>
                  <th className="pb-2 pr-3 font-medium">{t.colId}</th>
                  <th className="pb-2 pr-3 font-medium">{t.colName}</th>
                  <th className="pb-2 pr-3 font-medium">{t.colModel}</th>
                  <th className="pb-2 pr-3 font-medium">{t.colStatus}</th>
                  <th className="pb-2 pr-3 font-medium">{t.colProgress}</th>
                  <th className="pb-2 pr-3 font-medium">{t.colCost}</th>
                  <th className="pb-2 pr-3 font-medium">{t.colTime}</th>
                  <th className="pb-2 font-medium">{t.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const busy = busyId === job.id
                  return (
                    <tr key={job.id} className="border-b border-[var(--bx-border)]/60 align-top">
                      <td className="py-2.5 pr-3 font-mono text-xs text-[var(--bx-text-soft)]" title={job.id}>
                        <span className="line-clamp-1 max-w-[120px]">{job.id}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-[var(--bx-text)]">
                        <span className="line-clamp-2 max-w-[160px]">{job.task_name || '—'}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-[var(--bx-text-soft)]">
                        <span className="line-clamp-1 max-w-[140px]" title={job.model}>
                          {job.model}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(job.status)}`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-sm">
                        <span className="text-emerald-600 dark:text-emerald-300">{job.success_count}</span>
                        <span className="text-[var(--bx-text-dim)]"> / </span>
                        <span className={job.fail_count > 0 ? 'text-red-600 dark:text-red-300' : 'text-[var(--bx-text-dim)]'}>
                          {job.fail_count}
                        </span>
                        <span className="ml-1 text-xs text-[var(--bx-text-dim)]">({job.item_count})</span>
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-[var(--bx-text-soft)]">{formatCost(job)}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-[var(--bx-text-muted)]">
                        {formatTs(job.created_at)}
                      </td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="bx-btn bx-btn-ghost bx-btn-sm"
                            disabled={busy || !keyReady}
                            onClick={() => void openItems(job)}
                          >
                            {t.items}
                          </button>
                          {canCancel(job.status) ? (
                            <button
                              type="button"
                              className="bx-btn bx-btn-ghost bx-btn-sm"
                              disabled={busy}
                              onClick={() => void onCancel(job)}
                            >
                              {t.cancel}
                            </button>
                          ) : null}
                          {canDownload(job) ? (
                            <button
                              type="button"
                              className="bx-btn bx-btn-ghost bx-btn-sm"
                              disabled={busy}
                              onClick={() => void onDownload(job)}
                            >
                              {t.download}
                            </button>
                          ) : null}
                          {canDelete(job) ? (
                            <button
                              type="button"
                              className="bx-btn bx-btn-ghost bx-btn-sm text-red-600 hover:text-red-500"
                              disabled={busy}
                              onClick={() => void onDelete(job)}
                            >
                              {t.delete}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Items modal */}
      {itemsJob ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setItemsJob(null)
            setItems([])
          }}
        >
          <div
            className="bx-card max-h-[85vh] w-full max-w-3xl overflow-hidden p-0 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--bx-border)] px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-[var(--bx-text)]">
                  {t.items}
                  {itemsJob.task_name ? ` · ${itemsJob.task_name}` : ''}
                </h3>
                <p className="mt-0.5 truncate font-mono text-xs text-[var(--bx-text-dim)]">{itemsJob.id}</p>
              </div>
              <button
                type="button"
                className="bx-btn bx-btn-ghost bx-btn-sm"
                onClick={() => {
                  setItemsJob(null)
                  setItems([])
                }}
              >
                ×
              </button>
            </div>
            <div className="max-h-[calc(85vh-4.5rem)] overflow-y-auto px-5 py-4">
              {loadingItems ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : items.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--bx-text-dim)]">{t.empty}</p>
              ) : (
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-[var(--bx-border)] text-xs text-[var(--bx-text-dim)]">
                    <tr>
                      <th className="pb-2 pr-3 font-medium">custom_id</th>
                      <th className="pb-2 pr-3 font-medium">prompt</th>
                      <th className="pb-2 pr-3 font-medium">{t.colStatus}</th>
                      <th className="pb-2 font-medium">images</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.custom_id} className="border-b border-[var(--bx-border)]/60 align-top">
                        <td className="py-2 pr-3 font-mono text-xs">{item.custom_id}</td>
                        <td className="py-2 pr-3 text-[var(--bx-text-soft)]">
                          <span className="line-clamp-2" title={item.prompt_preview || undefined}>
                            {item.prompt_preview || '—'}
                          </span>
                          {item.error?.message ? (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{item.error.message}</p>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(item.status)}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2 tabular-nums text-[var(--bx-text-soft)]">{item.image_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
