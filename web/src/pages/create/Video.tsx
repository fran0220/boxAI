import { FormEvent, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CircleAlert,
  Clapperboard,
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
  addAsset,
  listAssets,
  removeAsset,
  updateAsset,
  type AssetRecord,
} from '@/lib/assets-db'
import { fileToDataUrl } from '@/lib/blob'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { ModelPicker } from './components/ModelPicker'

type JobStatus = 'queued' | 'processing' | 'succeeded' | 'failed'

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
  const timersRef = useRef<Map<string, number>>(new Map())
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void listAssets('video').then(setHistory)
    const timers = timersRef.current
    return () => {
      for (const t of timers.values()) window.clearInterval(t)
      timers.clear()
    }
  }, [])

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
    setJobs((prev) => prev.map((j) => (j.localId === localId ? { ...j, ...patch } : j)))
  }

  async function completeJob(job: VideoJob, url: string) {
    updateJob(job.localId, { status: 'succeeded', url })
    const saved = await addAsset({
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[340px_1fr]">
        {/* Composer */}
        <form onSubmit={onSubmit} className="bx-card h-fit space-y-4 p-5 lg:sticky lg:top-4">
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <Clapperboard size={17} className="text-[var(--bx-teal)]" />
            {d.create.video.title}
          </h1>
          <div>
            <label className="bx-label">{d.create.model.label}</label>
            <ModelPicker value={model} onChange={setModel} kind="video" />
          </div>
          <div>
            <label className="bx-label" htmlFor="vid-prompt">
              {d.create.video.title}
            </label>
            <textarea
              id="vid-prompt"
              className="bx-input min-h-[110px] text-sm"
              placeholder={d.create.video.promptPlaceholder}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
            />
          </div>

          {/* First frame */}
          <div>
            <label className="bx-label">{d.create.video.firstFrame}</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onPickFrame(e.target.files?.[0])}
            />
            {frameUrl ? (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--bx-teal)] bg-[var(--bx-active)] p-2">
                <img src={frameUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <p className="min-w-0 flex-1 text-xs text-[var(--bx-teal)]">
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
                  className="rounded-lg p-1.5 text-[var(--bx-text-dim)] hover:text-[var(--bx-text)]"
                  aria-label={d.create.video.firstFrameRemove}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--bx-border-strong)] px-3 py-3 text-sm text-[var(--bx-text-muted)] transition-colors hover:bg-[var(--bx-hover)]"
              >
                <ImagePlus size={15} />
                {d.create.video.firstFrameAdd}
              </button>
            )}
          </div>

          <button type="submit" disabled={busy || !model} className="bx-btn bx-btn-primary w-full">
            <Sparkles size={15} />
            {d.create.video.generate}
          </button>
        </form>

        {/* Jobs + history */}
        <div className="space-y-6">
          {empty ? (
            <div className="bx-card flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
              <Clapperboard size={28} className="text-[var(--bx-text-dim)]" />
              <h2 className="text-base font-semibold">{d.create.video.emptyTitle}</h2>
              <p className="max-w-sm text-sm text-[var(--bx-text-dim)]">{d.create.video.emptyBody}</p>
            </div>
          ) : (
            <>
              {jobs.length > 0 && (
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--bx-text-dim)]">
                    {d.create.video.jobs}
                  </p>
                  <div className="space-y-3">
                    {jobs.map((job) => (
                      <div key={job.localId} className="bx-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            {job.frameUrl ? (
                              <img src={job.frameUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                            ) : null}
                            <p className="min-w-0 flex-1 truncate text-sm" title={job.prompt}>
                              {job.prompt}
                            </p>
                          </div>
                          <span
                            className={cx(
                              'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs',
                              job.status === 'succeeded' && 'bg-[var(--bx-active)] text-[var(--bx-teal)]',
                              job.status === 'failed' && 'bg-red-500/10 text-red-400',
                              (job.status === 'queued' || job.status === 'processing') &&
                                'bg-[var(--bx-bg-muted)] text-[var(--bx-text-muted)]',
                            )}
                          >
                            {job.status === 'queued' || job.status === 'processing' ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : job.status === 'failed' ? (
                              <CircleAlert size={12} />
                            ) : (
                              <Play size={12} />
                            )}
                            {statusLabel[job.status]}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--bx-text-dim)]">
                          {job.model} · {new Date(job.createdAt).toLocaleTimeString()}
                        </p>
                        {job.error ? (
                          <div className="mt-2 flex items-center gap-2">
                            <p className="min-w-0 flex-1 text-xs text-red-400">{job.error}</p>
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
                            <video src={job.url} controls className="w-full rounded-xl" />
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
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {history.length > 0 && (
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--bx-text-dim)]">
                    {d.create.video.history}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {history.map((asset) => (
                      <div key={asset.id} className="bx-card p-3">
                        <video src={asset.payload} controls className="w-full rounded-lg" preload="metadata" />
                        <div className="mt-2 flex items-center gap-1.5">
                          <p className="min-w-0 flex-1 truncate text-xs text-[var(--bx-text-muted)]" title={asset.title}>
                            {asset.title}
                          </p>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-[var(--bx-text-dim)] transition-colors hover:text-[var(--bx-teal)]"
                            onClick={() => void toggleFavorite(asset)}
                            aria-label={asset.favorite ? d.create.actions.unfavorite : d.create.actions.favorite}
                          >
                            <Star
                              size={13}
                              className={asset.favorite ? 'fill-[var(--bx-teal)] text-[var(--bx-teal)]' : undefined}
                            />
                          </button>
                          <a
                            href={asset.payload}
                            download
                            target="_blank"
                            rel="noopener"
                            className="rounded-lg p-1.5 text-[var(--bx-text-dim)] transition-colors hover:text-[var(--bx-text)]"
                            aria-label={d.common.download}
                          >
                            <Download size={13} />
                          </a>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-[var(--bx-text-dim)] transition-colors hover:text-red-400"
                            onClick={() => void deleteAsset(asset)}
                            aria-label={d.common.delete}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
