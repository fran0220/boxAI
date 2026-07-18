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
import { cx } from '@/lib/cx'

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

function progressPct(job: BatchImageJob): number {
  const total = job.item_count || 0
  if (total <= 0) return ACTIVE_STATUSES.has(String(job.status)) ? 8 : 0
  if (job.status === 'completed') return 100
  const done = (job.success_count || 0) + (job.fail_count || 0)
  return Math.min(100, Math.round((done / total) * 100))
}

function statusClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'completed') return 'bx-account-status bx-account-status--ok'
  if (s === 'failed' || s === 'output_deleted') return 'bx-account-status bx-account-status--danger'
  if (s === 'cancelled') return 'bx-account-status bx-account-status--muted'
  if (ACTIVE_STATUSES.has(s)) return 'bx-account-status bx-account-status--brand'
  return 'bx-account-status bx-account-status--muted'
}

function batchStatusLabel(
  status: string,
  labels: {
    statusQueued: string
    statusRunning: string
    statusCompleted: string
    statusFailed: string
    statusCancelled: string
    statusOutputDeleted: string
    statusIndexing: string
    statusProcessing: string
    statusSettling: string
  },
): string {
  switch (String(status || '').toLowerCase()) {
    case 'queued':
      return labels.statusQueued
    case 'running':
      return labels.statusRunning
    case 'completed':
      return labels.statusCompleted
    case 'failed':
      return labels.statusFailed
    case 'cancelled':
      return labels.statusCancelled
    case 'output_deleted':
      return labels.statusOutputDeleted
    case 'indexing':
      return labels.statusIndexing
    case 'processing_results':
      return labels.statusProcessing
    case 'settling':
      return labels.statusSettling
    default:
      return status || '—'
  }
}

/** Optional preview fields when gateway returns them (not always present). */
function extractItemPreviewUrls(item: BatchImageItem): string[] {
  const urls = [
    item.thumbnail_url,
    item.image_url,
    ...(Array.isArray(item.image_urls) ? item.image_urls : []),
  ]
  return urls.filter((u): u is string => typeof u === 'string' && u.length > 0)
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

  const [model, setModel] = useState('')
  const [taskName, setTaskName] = useState('')
  const [imageSize, setImageSize] = useState<(typeof IMAGE_SIZES)[number]>('1K')
  const [aspectRatio, setAspectRatio] = useState<(typeof ASPECT_RATIOS)[number]>('')
  const [prompts, setPrompts] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(true)
  const [showKeyPanel, setShowKeyPanel] = useState(() => !readStoredKey())

  const [itemsJob, setItemsJob] = useState<BatchImageJob | null>(null)
  const [items, setItems] = useState<BatchImageItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  /** Real preview URLs only — never fake placeholder tiles. */
  const [galleryThumbs, setGalleryThumbs] = useState<Array<{ id: string; url: string; label: string }>>(
    [],
  )

  const keyReady = apiKey.trim().length > 0

  const promptCount = useMemo(
    () =>
      prompts
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean).length,
    [prompts],
  )

  // Only show a $ estimate when models API exposes a real unit price.
  // Never invent 0.04/0.05/0.08 client-side placeholders.
  const selectedModel = useMemo(
    () => models.find((m) => m.id === model) ?? null,
    [models, model],
  )
  const unitPrice = useMemo(() => {
    const raw = selectedModel?.unit_price ?? selectedModel?.price
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null
  }, [selectedModel])
  const estimatedHint = useMemo(() => {
    if (promptCount <= 0 || unitPrice == null) return null
    const est = promptCount * unitPrice
    return t.estCost.replace('{amount}', est.toFixed(2))
  }, [promptCount, unitPrice, t.estCost])

  const onApiKeyChange = (value: string) => {
    setApiKey(value)
    writeStoredKey(value.trim())
    if (value.trim()) setShowKeyPanel(false)
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
      const list = res.data || []
      setJobs(list)
      // Gallery: only real image URLs. Probe one completed job first — skip extra
      // fetches when the gateway items schema has no preview URL fields.
      const completed = list.filter((j) => j.status === 'completed' && (j.success_count || 0) > 0)
      const thumbs: Array<{ id: string; url: string; label: string }> = []
      if (completed.length > 0) {
        try {
          const probe = await listBatchImageItems(key, completed[0].id, 'completed')
          const probeItems = probe.data || []
          const probeHasUrls = probeItems.some((item) => extractItemPreviewUrls(item).length > 0)
          if (probeHasUrls) {
            for (const j of completed.slice(0, 4)) {
              const itemRes =
                j.id === completed[0].id
                  ? { data: probeItems }
                  : await listBatchImageItems(key, j.id, 'completed')
              for (const item of itemRes.data || []) {
                for (const url of extractItemPreviewUrls(item)) {
                  if (thumbs.length >= 12) break
                  thumbs.push({
                    id: `${j.id}-${item.custom_id}-${thumbs.length}`,
                    url,
                    label: j.task_name || j.model || item.custom_id,
                  })
                }
                if (thumbs.length >= 12) break
              }
              if (thumbs.length >= 12) break
            }
          }
        } catch {
          /* gallery optional */
        }
      }
      setGalleryThumbs(thumbs)
    } catch (err) {
      setJobs([])
      setGalleryThumbs([])
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

  useEffect(() => {
    if (apiKey.trim()) void loadJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot only when key first present
  }, [])

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

  async function downloadLatestZip() {
    const job = jobs.find((j) => canDownload(j))
    if (!job) {
      setError(t.noDownloadable)
      return
    }
    await onDownload(job)
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="bx-account-page-title">{t.title}</h1>
          <p className="bx-account-page-sub">{t.subtitle}</p>
        </div>
        <button
          type="button"
          className="bx-btn bx-btn-primary bx-btn-sm"
          onClick={() => setShowForm(true)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          {t.newBatch}
        </button>
      </div>

      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-[var(--bx-success)]">{success}</p> : null}

      {/* Design grid first: submit | jobs — API key is secondary/collapsible */}
      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        {showForm ? (
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="bx-account-panel bx-account-panel-pad"
          >
            <p className="m-0 mb-3 text-[13.5px] font-bold">{t.quickSubmit}</p>
            <label className="block">
              <span className="bx-account-field-label">{t.prompts}</span>
              <textarea
                rows={4}
                className="bx-account-input-muted font-mono text-[12.5px]"
                value={prompts}
                onChange={(e) => setPrompts(e.target.value)}
                placeholder={t.promptsPlaceholder}
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="bx-account-field-label">{t.model}</span>
                <select
                  className="bx-account-input-muted"
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
              </label>
              <label className="block">
                <span className="bx-account-field-label">{t.imageSize}</span>
                <select
                  className="bx-account-input-muted"
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value as (typeof IMAGE_SIZES)[number])}
                >
                  {IMAGE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <details className="mt-2.5">
              <summary className="bx-account-collapse-btn cursor-pointer list-none">
                {t.advancedOptions}
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="bx-account-field-label">{t.aspectRatio}</span>
                  <select
                    className="bx-account-input-muted"
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value as (typeof ASPECT_RATIOS)[number])}
                  >
                    {ASPECT_RATIOS.map((r) => (
                      <option key={r || 'auto'} value={r}>
                        {r || '—'}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="bx-account-field-label">{t.taskName}</span>
                  <input
                    className="bx-account-input-muted"
                    value={taskName}
                    maxLength={255}
                    onChange={(e) => setTaskName(e.target.value)}
                  />
                </label>
              </div>
            </details>
            <button
              type="submit"
              className="bx-btn bx-btn-primary mt-3.5 w-full"
              disabled={!keyReady || submitting || !model || promptCount === 0}
              title={!keyReady ? t.selectKey : undefined}
            >
              {submitting
                ? t.submitting
                : estimatedHint
                  ? `${t.submit} · ${estimatedHint}`
                  : promptCount > 0
                    ? `${t.submit} · ${t.estItems.replace('{n}', String(promptCount))}`
                    : t.submit}
            </button>
            {!keyReady ? (
              <p className="bx-account-stat-hint mt-2">
                {t.needKeyHint}{' '}
                <button
                  type="button"
                  className="border-none bg-transparent p-0 font-mono text-[11px] font-semibold text-[var(--bx-brand-bright)]"
                  onClick={() => setShowKeyPanel(true)}
                >
                  {t.configureKey}
                </button>
              </p>
            ) : null}
          </form>
        ) : (
          <div className="bx-account-panel">
            <p className="bx-account-empty">{t.quickSubmit}</p>
          </div>
        )}

        <div className="bx-account-panel overflow-hidden">
          <p className="m-0 px-5 pb-2.5 pt-3.5 text-[13.5px] font-bold">{t.recentBatches}</p>
          {loadingJobs ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : jobs.length === 0 ? (
            <p className="bx-account-empty">{t.empty}</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {jobs.slice(0, 8).map((job) => {
                const pct = progressPct(job)
                const busy = busyId === job.id
                const label =
                  job.task_name ||
                  `${job.model}${job.item_count ? ` · ${job.item_count}` : ''}`
                return (
                  <li key={job.id} className="border-t border-[var(--bx-line)] px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate font-mono text-xs text-[var(--bx-text-soft)]">
                        {label}
                      </span>
                      <span className={cx('shrink-0', statusClass(job.status))}>
                        {batchStatusLabel(job.status, t)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2.5">
                      <span className="bx-account-progress flex-1">
                        <i
                          style={{ width: `${pct}%` }}
                          className={cx(
                            job.status === 'failed' && 'is-danger',
                            ACTIVE_STATUSES.has(String(job.status)) && 'is-warn',
                          )}
                        />
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] text-[var(--bx-text-dim)]">
                        {job.success_count}/{job.item_count} · {job.model} · {formatCost(job)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="bx-account-outline-btn"
                        disabled={busy || !keyReady}
                        onClick={() => void openItems(job)}
                      >
                        {t.items}
                      </button>
                      {canCancel(job.status) ? (
                        <button
                          type="button"
                          className="bx-account-outline-btn"
                          disabled={busy}
                          onClick={() => void onCancel(job)}
                        >
                          {t.cancel}
                        </button>
                      ) : null}
                      {canDownload(job) ? (
                        <button
                          type="button"
                          className="bx-account-outline-btn"
                          disabled={busy}
                          onClick={() => void onDownload(job)}
                        >
                          {t.download}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="bx-account-outline-btn bx-account-outline-btn--danger"
                        disabled={busy}
                        onClick={() => void onDelete(job)}
                      >
                        {t.delete}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Secondary: API key (collapsible so it doesn't block the design grid) */}
      <div className="bx-account-panel mt-3 overflow-hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
          onClick={() => setShowKeyPanel((v) => !v)}
          aria-expanded={showKeyPanel}
        >
          <span className="text-[13px] font-bold">{t.apiKeyPanel}</span>
          <span className="bx-account-collapse-btn">
            {keyReady ? t.keyReady : t.keyMissing}
            <span aria-hidden>{showKeyPanel ? '▴' : '▾'}</span>
          </span>
        </button>
        {showKeyPanel ? (
          <div className="border-t border-[var(--bx-line)] px-5 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[220px] flex-1">
                <span className="bx-account-field-label">{t.selectKey}</span>
                <input
                  type="password"
                  autoComplete="off"
                  className="bx-account-input-muted font-mono text-sm"
                  placeholder={t.pasteKey}
                  value={apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="bx-btn bx-btn-ghost bx-btn-sm"
                disabled={!keyReady || loadingJobs}
                onClick={() => void loadJobs()}
              >
                {loadingJobs ? t.refresh : t.loadJobs}
              </button>
              <Link to="/app/developer/keys" className="bx-btn bx-btn-ghost bx-btn-sm">
                {t.openKeys}
              </Link>
            </div>
            <p className="bx-account-stat-hint mt-2">{t.selectKeyHint}</p>
          </div>
        ) : null}
      </div>

      {/* Gallery: real thumbs only; single empty state when no URLs */}
      <div className="bx-account-panel bx-account-panel-pad mt-3">
        <div className="flex items-center justify-between">
          <p className="m-0 text-[13.5px] font-bold">{t.latestOutputs}</p>
          <button
            type="button"
            className="border-none bg-transparent font-mono text-[11px] font-semibold text-[var(--bx-brand-bright)] hover:opacity-80"
            disabled={!jobs.some(canDownload)}
            onClick={() => void downloadLatestZip()}
          >
            {t.packZip}
          </button>
        </div>
        {galleryThumbs.length === 0 ? (
          <p className="bx-account-empty mt-3.5">{t.galleryHint}</p>
        ) : (
          <div className="bx-account-gallery mt-3.5">
            {galleryThumbs.map((thumb) => (
              <a
                key={thumb.id}
                href={thumb.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bx-account-gallery-tile overflow-hidden no-underline"
                title={thumb.label}
              >
                <img src={thumb.url} alt="" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Items modal */}
      {itemsJob ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t.itemsModalTitle}
          onClick={() => {
            setItemsJob(null)
            setItems([])
          }}
        >
          <div
            className="bx-account-panel max-h-[85vh] w-full max-w-3xl overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--bx-border)] px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-[var(--bx-text)]">
                  {t.itemsModalTitle}
                  {itemsJob.task_name ? ` · ${itemsJob.task_name}` : ''}
                </h3>
                <p className="mt-0.5 truncate font-mono text-xs text-[var(--bx-text-dim)]">
                  {itemsJob.id}
                </p>
              </div>
              <button
                type="button"
                className="bx-account-outline-btn"
                aria-label={d.common.close}
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
                <p className="bx-account-empty">{t.empty}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="bx-account-table min-w-[520px]">
                    <thead>
                      <tr>
                        <th>{t.colCustomId}</th>
                        <th>{t.colPrompt}</th>
                        <th>{t.colStatus}</th>
                        <th>{t.colImages}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.custom_id}>
                          <td className="font-mono text-xs">{item.custom_id}</td>
                          <td className="text-[var(--bx-text-soft)]">
                            <span className="line-clamp-2" title={item.prompt_preview || undefined}>
                              {item.prompt_preview || '—'}
                            </span>
                            {item.error?.message ? (
                              <p className="mt-1 text-xs text-[var(--bx-danger)]">
                                {item.error.message}
                              </p>
                            ) : null}
                          </td>
                          <td>
                            <span className={statusClass(item.status)}>
                              {batchStatusLabel(item.status, t)}
                            </span>
                          </td>
                          <td className="num">{item.image_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
