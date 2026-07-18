import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CircleAlert,
  Download,
  ImagePlus,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { videoGenerations, videoStatus, ApiError } from '@/lib/api'
import {
  listAvailableChannels,
  type AvailableChannel,
  type UserSupportedModelPricing,
} from '@/lib/customer-api'
import {
  addAsset,
  listAssets,
  removeAsset,
  updateAsset,
  type AssetRecord,
} from '@/lib/assets-db'
import { fileToDataUrl } from '@/lib/blob'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { flushOutbox, getCloudSnapshot, stageRecord } from '@/lib/creator-cloud'
import { ModelPicker } from './components/ModelPicker'

type JobStatus = 'queued' | 'processing' | 'succeeded' | 'failed'

/** Duration badge only when media metadata yields a real duration. */
function VideoThumb({ src }: { src: string }) {
  const [durationLabel, setDurationLabel] = useState<string | null>(null)
  return (
    <div className="relative flex aspect-video items-center justify-center bg-[var(--bx-bg-muted)]">
      <video
        src={src}
        preload="metadata"
        muted
        className="absolute inset-0 h-full w-full object-cover"
        onLoadedMetadata={(e) => {
          const sec = e.currentTarget.duration
          if (!Number.isFinite(sec) || sec <= 0) return
          const m = Math.floor(sec / 60)
          const s = Math.floor(sec % 60)
          setDurationLabel(`${m}:${String(s).padStart(2, '0')}`)
        }}
      />
      <span className="bx-media-overlay relative z-[1] flex h-[38px] w-[38px] items-center justify-center rounded-lg">
        <Play size={15} fill="currentColor" />
      </span>
      {durationLabel ? (
        <span className="absolute bottom-2 right-2 z-[1] rounded bg-[rgba(2,4,5,0.6)] px-[7px] py-0.5 font-mono text-[9.5px] text-white/90">
          {durationLabel}
        </span>
      ) : null}
    </div>
  )
}

interface VideoJob {
  localId: string
  remoteId?: string
  prompt: string
  model: string
  frameUrl?: string
  status: JobStatus
  url?: string
  error?: string
  createdAt: number
}

const DONE = ['completed', 'succeeded', 'done', 'success']
const FAILED = ['failed', 'error', 'cancelled']
const POLL_MS = 3000
const MAX_POLLS = 200

function extractUrl(data: Record<string, unknown>): string {
  if (typeof data.url === 'string') return data.url
  if (typeof data.video_url === 'string') return data.video_url
  const output = data.output as { url?: string } | undefined
  if (output?.url) return output.url
  const dataArr = data.data as Array<{ url?: string }> | undefined
  if (dataArr?.[0]?.url) return dataArr[0].url
  return ''
}

/** Real unit price only — never invent design placeholders like $0.28. */
function formatUnitPrice(p: UserSupportedModelPricing | null | undefined): string | null {
  if (!p) return null
  const unit = p.per_request_price ?? p.image_output_price
  if (unit == null || Number.isNaN(Number(unit))) return null
  const n = Number(unit)
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

function findModelUnitPrice(channels: AvailableChannel[], modelId: string): string | null {
  const want = modelId.toLowerCase()
  for (const ch of channels) {
    for (const section of ch.platforms || []) {
      for (const m of section.supported_models || []) {
        if ((m.name || '').toLowerCase() === want) {
          const label = formatUnitPrice(m.pricing)
          if (label) return label
        }
      }
    }
  }
  return null
}

export function VideoGen() {
  const { d } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()

  const [model, setModel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [frameUrl, setFrameUrl] = useState('')
  const [frameFromCreator, setFrameFromCreator] = useState(false)
  const [busy, setBusy] = useState(false)
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [history, setHistory] = useState<AssetRecord[]>([])
  /** Real per-request price for selected model when channels API exposes it. */
  const [modelPrice, setModelPrice] = useState<string | null>(null)
  const timersRef = useRef<Map<string, number>>(new Map())
  const fileRef = useRef<HTMLInputElement>(null)
  const channelsCacheRef = useRef<AvailableChannel[] | null>(null)

  useEffect(() => {
    void listAssets('video').then(setHistory)
    void getCloudSnapshot<VideoJob>('video_job').then(({ records }) => {
      const restored = records.filter((record) => !record.deleted_at).map((record) => ({ ...record.payload, localId: record.client_id }))
      setJobs(restored)
      for (const job of restored) {
        if ((job.status === 'queued' || job.status === 'processing') && job.remoteId) startPolling(job, job.remoteId)
      }
    }).catch(() => undefined)
    const timers = timersRef.current
    return () => {
      for (const t of timers.values()) window.clearInterval(t)
      timers.clear()
    }
  }, [])

  // Optional cost line: only when available-channels returns a real unit price.
  useEffect(() => {
    if (!model) {
      setModelPrice(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        if (!channelsCacheRef.current) {
          channelsCacheRef.current = await listAvailableChannels()
        }
        if (cancelled) return
        setModelPrice(findModelUnitPrice(channelsCacheRef.current || [], model))
      } catch {
        if (!cancelled) setModelPrice(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [model])

  const generateHint = useMemo(() => {
    const asyncHint = d.create.video.asyncHint
    if (modelPrice) return `≈ ${modelPrice} · ${asyncHint}`
    return asyncHint
  }, [d.create.video.asyncHint, modelPrice])

  // Cross-module handoff: "Make video" on an image passes { frame, prompt }.
  useEffect(() => {
    const state = location.state as { frame?: string; prompt?: string } | null
    if (state?.frame) {
      setFrameUrl(state.frame)
      setFrameFromCreator(true)
      if (state.prompt) setPrompt(state.prompt)
      navigate(location.pathname, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onPickFrame(file: File | undefined) {
    if (!file) return
    try {
      setFrameUrl(await fileToDataUrl(file))
      setFrameFromCreator(false)
    } catch {
      setFrameUrl('')
    }
  }

  function updateJob(localId: string, patch: Partial<VideoJob>) {
    setJobs((prev) => prev.map((j) => {
      if (j.localId !== localId) return j
      const updated = { ...j, ...patch }
      persistVideoJob(updated)
      return updated
    }))
  }

  function persistVideoJob(job: VideoJob) {
    // A selected frame may be a data URL; binary belongs in object storage, never record JSON.
    const payload = job.frameUrl?.startsWith('data:') ? { ...job, frameUrl: undefined } : job
    stageRecord({ kind: 'video_job', clientId: job.localId, operation: 'upsert', payload })
    void flushOutbox()
  }

  async function completeJob(job: VideoJob, url: string) {
    updateJob(job.localId, { status: 'succeeded', url })
    const saved = await addAsset({
      id: `video-${job.localId}`,
      kind: 'video',
      title: job.prompt.slice(0, 80),
      model: job.model,
      prompt: job.prompt,
      payload: url,
      meta: { id: job.remoteId, i2v: !!job.frameUrl },
    })
    setHistory((prev) => [saved, ...prev])
  }

  function startPolling(job: VideoJob, remoteId: string) {
    if (timersRef.current.has(job.localId) || [...timersRef.current.keys()].some((id) => jobs.find((item) => item.localId === id)?.remoteId === remoteId)) return
    let attempts = 0
    const timer = window.setInterval(async () => {
      attempts++
      try {
        const data = (await videoStatus(remoteId)) as Record<string, unknown>
        const st = String(data.status || data.state || '').toLowerCase()
        const url = extractUrl(data)
        if (url || DONE.includes(st)) {
          window.clearInterval(timer)
          timersRef.current.delete(job.localId)
          if (url) await completeJob({ ...job, remoteId }, url)
          else updateJob(job.localId, { status: 'failed', error: d.create.video.noUrl })
          return
        }
        if (FAILED.includes(st)) {
          window.clearInterval(timer)
          timersRef.current.delete(job.localId)
          updateJob(job.localId, { status: 'failed', error: st })
          return
        }
        if (st) updateJob(job.localId, { status: 'processing' })
        if (attempts > MAX_POLLS) {
          window.clearInterval(timer)
          timersRef.current.delete(job.localId)
          updateJob(job.localId, { status: 'failed', error: 'timeout' })
        }
      } catch (err) {
        window.clearInterval(timer)
        timersRef.current.delete(job.localId)
        updateJob(job.localId, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'poll failed',
        })
      }
    }, POLL_MS)
    timersRef.current.set(job.localId, timer)
  }

  async function launch(input: { prompt: string; model: string; frameUrl?: string }) {
    setBusy(true)
    const job: VideoJob = {
      localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: input.prompt,
      model: input.model,
      frameUrl: input.frameUrl,
      status: 'queued',
      createdAt: Date.now(),
    }
    setJobs((prev) => [job, ...prev])
    persistVideoJob(job)
    try {
      const payload: Record<string, unknown> = { model: input.model, prompt: input.prompt }
      if (input.frameUrl) payload.image = input.frameUrl
      const created = (await videoGenerations(payload)) as Record<string, unknown>
      const remoteId = String(created.id || created.video_id || '')
      const url = extractUrl(created)
      if (url) {
        await completeJob({ ...job, remoteId }, url)
      } else if (remoteId) {
        updateJob(job.localId, { status: 'processing', remoteId })
        startPolling(job, remoteId)
      } else {
        updateJob(job.localId, { status: 'failed', error: d.create.video.noUrl })
      }
    } catch (err) {
      updateJob(job.localId, {
        status: 'failed',
        error: err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed',
      })
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const text = prompt.trim()
    if (!text || busy || !model) return
    setPrompt('')
    void launch({ prompt: text, model, frameUrl: frameUrl || undefined })
  }

  function retryJob(job: VideoJob) {
    setJobs((prev) => prev.filter((j) => j.localId !== job.localId))
    void launch({ prompt: job.prompt, model: job.model, frameUrl: job.frameUrl })
  }

  async function toggleFavorite(asset: AssetRecord) {
    const updated = await updateAsset(asset.id, { favorite: !asset.favorite })
    if (!updated) return
    setHistory((prev) => prev.map((a) => (a.id === asset.id ? updated : a)))
  }

  async function deleteAsset(asset: AssetRecord) {
    if (!window.confirm(d.create.assets.deleteConfirm)) return
    await removeAsset(asset.id)
    setHistory((prev) => prev.filter((a) => a.id !== asset.id))
  }

  const statusLabel: Record<JobStatus, string> = {
    queued: d.create.video.statusQueued,
    processing: d.create.video.statusProcessing,
    succeeded: d.create.video.statusSucceeded,
    failed: d.create.video.statusFailed,
  }

  const empty = jobs.length === 0 && history.length === 0

  function statusPillClass(status: JobStatus) {
    if (status === 'succeeded') return 'bx-status-pill bx-status-pill--succeeded'
    if (status === 'failed') return 'bx-status-pill bx-status-pill--failed'
    if (status === 'processing') return 'bx-status-pill bx-status-pill--processing'
    return 'bx-status-pill bx-status-pill--queued'
  }

  return (
    <div className="bx-create-scroll">
      <div className="bx-create-page bx-create-page--video">
        {/* Composer — design: sticky left form 340px */}
        <form
          onSubmit={onSubmit}
          className="bx-create-panel h-fit space-y-3.5 p-[18px] lg:sticky lg:top-4"
        >
          <h1 className="bx-create-panel-title">{d.create.video.title}</h1>

          <div>
            <label className="bx-create-field-label">{d.create.model.label}</label>
            <ModelPicker value={model} onChange={setModel} kind="video" />
          </div>

          <div>
            <label className="bx-create-field-label" htmlFor="vid-prompt">
              {d.create.video.promptLabel}
            </label>
            <textarea
              id="vid-prompt"
              className="bx-input min-h-[104px] text-[13px] leading-relaxed"
              placeholder={d.create.video.promptPlaceholder}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
            />
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onPickFrame(e.target.files?.[0])}
            />
            {frameUrl ? (
              <div className="bx-thumb-selected flex items-center gap-3 rounded-[7px] p-2">
                <img
                  src={frameUrl}
                  alt=""
                  className="h-12 w-12 rounded-[var(--bx-radius-sm)] object-cover"
                />
                <p className="min-w-0 flex-1 text-xs text-[var(--bx-brand-bright)]">
                  {d.create.video.firstFrameActive}
                  {frameFromCreator ? (
                    <span className="mt-0.5 block text-[10px] text-[var(--bx-text-dim)]">
                      {d.create.video.firstFrameFrom}
                    </span>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFrameUrl('')
                    setFrameFromCreator(false)
                  }}
                  className="rounded-[var(--bx-radius-sm)] p-1.5 text-[var(--bx-text-dim)] hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
                  aria-label={d.create.video.firstFrameRemove}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="bx-dropzone">
                <ImagePlus size={13} />
                {d.create.video.firstFrameAdd}
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={busy || !model}
            className="bx-btn bx-btn-primary w-full !rounded-[7px] !py-2.5 !text-[13.5px]"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {d.create.video.generate}
          </button>
          {/* Design: "≈ $X · 异步任务可并行提交" — $ only when channels API has real unit price */}
          <p className="bx-create-hint">{generateHint}</p>
        </form>

        {/* Jobs + history */}
        <div className="flex flex-col gap-3">
          {empty ? (
            <div className="bx-empty-state min-h-[320px]">
              <strong>{d.create.video.emptyTitle}</strong>
              <p className="max-w-sm text-sm leading-relaxed">{d.create.video.emptyBody}</p>
            </div>
          ) : (
            <>
              {jobs.length > 0 && (
                <section className="flex flex-col gap-3">
                  <p className="bx-create-section-label">{d.create.video.jobs}</p>
                  {jobs.map((job) => (
                    <article key={job.localId} className="bx-create-panel px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {job.status === 'queued' || job.status === 'processing' ? (
                          <span
                            className="inline-flex h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--bx-brand)] border-t-transparent"
                            aria-hidden
                          />
                        ) : job.frameUrl ? (
                          <img
                            src={job.frameUrl}
                            alt=""
                            className="h-3.5 w-3.5 shrink-0 rounded-sm object-cover"
                          />
                        ) : (
                          <Play size={14} className="shrink-0 text-[var(--bx-text-dim)]" />
                        )}
                        <p className="min-w-0 flex-1 truncate text-[13px]" title={job.prompt}>
                          {job.prompt}
                        </p>
                        <span className={statusPillClass(job.status)}>
                          {job.status === 'failed' ? <CircleAlert size={12} /> : null}
                          {statusLabel[job.status]}
                        </span>
                      </div>
                      {(job.status === 'queued' || job.status === 'processing') && (
                        <div className="bx-create-job-progress" aria-hidden>
                          <div className="bx-create-job-progress-fill" />
                        </div>
                      )}
                      <p className="mt-2 font-mono text-[10.5px] text-[var(--bx-text-dim)]">
                        {job.model}
                        {' · '}
                        {new Date(job.createdAt).toLocaleTimeString()}
                        {job.frameUrl ? ' · i2v' : ''}
                      </p>
                      {job.error ? (
                        <div className="mt-3 flex items-center gap-2">
                          <p className="bx-text-danger min-w-0 flex-1 text-xs">{job.error}</p>
                          <button
                            type="button"
                            className="bx-btn bx-btn-ghost bx-btn-sm"
                            onClick={() => retryJob(job)}
                          >
                            <RefreshCw size={12} />
                            {d.create.job.retry}
                          </button>
                        </div>
                      ) : null}
                      {job.url ? (
                        <div className="mt-3 space-y-2">
                          <video
                            src={job.url}
                            controls
                            className="w-full rounded-[var(--bx-radius-md)]"
                          />
                          <a
                            href={job.url}
                            download
                            target="_blank"
                            rel="noopener"
                            className="bx-btn bx-btn-ghost bx-btn-sm"
                          >
                            <Download size={13} />
                            {d.common.download}
                          </a>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </section>
              )}

              {history.length > 0 && (
                <section className="flex flex-col gap-3">
                  <p className={cx('bx-create-section-label', jobs.length > 0 && 'mt-2')}>
                    {d.create.video.history}
                  </p>
                  <div className="bx-create-video-history-grid">
                    {history.map((asset) => (
                      <article
                        key={asset.id}
                        className="bx-create-panel overflow-hidden transition-[border-color] duration-[var(--bx-dur-fast)] hover:border-[var(--bx-brand-ring)]"
                      >
                        <VideoThumb src={asset.payload} />
                        <div className="flex items-center gap-1.5 px-3 py-2.5">
                          <p
                            className="min-w-0 flex-1 truncate text-xs text-[var(--bx-text-muted)]"
                            title={asset.title}
                          >
                            {asset.title}
                          </p>
                          <button
                            type="button"
                            className={cx(
                              'rounded-[var(--bx-radius-sm)] p-1.5 transition-colors',
                              asset.favorite
                                ? 'text-[var(--bx-brand-bright)]'
                                : 'text-[var(--bx-text-dim)] hover:text-[var(--bx-brand-bright)]',
                            )}
                            onClick={() => void toggleFavorite(asset)}
                            aria-label={
                              asset.favorite
                                ? d.create.actions.unfavorite
                                : d.create.actions.favorite
                            }
                          >
                            <Star
                              size={12}
                              className={asset.favorite ? 'fill-current' : undefined}
                            />
                          </button>
                          <a
                            href={asset.payload}
                            download
                            target="_blank"
                            rel="noopener"
                            className="rounded-[var(--bx-radius-sm)] p-1.5 text-[var(--bx-text-dim)] transition-colors hover:text-[var(--bx-text)]"
                            aria-label={d.common.download}
                          >
                            <Download size={12} />
                          </a>
                          <button
                            type="button"
                            className="bx-icon-btn bx-icon-btn--danger"
                            onClick={() => void deleteAsset(asset)}
                            aria-label={d.common.delete}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
