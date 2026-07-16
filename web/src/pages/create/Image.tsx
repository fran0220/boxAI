import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Clapperboard,
  Download,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  RefreshCw,
  Shuffle,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { imageEdits, imageGenerations, ApiError } from '@/lib/api'
import { addAsset, listAssets, removeAsset, updateAsset, type AssetRecord } from '@/lib/assets-db'
import { fileToDataUrl, imageUrlToBlob } from '@/lib/blob'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { Modal } from '@/components/ui/Modal'
import { ModelPicker } from './components/ModelPicker'

const ASPECTS = [
  { key: 'square' as const, ratio: '1:1', size: '1024x1024' },
  { key: 'landscape' as const, ratio: '16:9', size: '1792x1024' },
  { key: 'portrait' as const, ratio: '9:16', size: '1024x1792' },
]
const COUNTS = [1, 2, 3, 4] as const

interface ImageData {
  url?: string
  b64_json?: string
}

interface ImgJob {
  id: string
  prompt: string
  model: string
  size: string
  n: number
  refUrl?: string
  status: 'running' | 'error'
  error?: string
}

function jobId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function sizeRatio(size: string): string {
  const [w, h] = size.split('x').map(Number)
  if (!w || !h) return '1 / 1'
  return `${w} / ${h}`
}

export function ImageGen() {
  const { d } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  const [model, setModel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [aspect, setAspect] = useState(ASPECTS[0])
  const [count, setCount] = useState<number>(1)
  const [refUrl, setRefUrl] = useState<string>('')
  const [refError, setRefError] = useState('')
  const [jobs, setJobs] = useState<ImgJob[]>([])
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [focus, setFocus] = useState<AssetRecord | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void listAssets('image').then(setAssets)
  }, [])

  // Cross-module handoff: Assets "Use as reference" passes { reference }.
  useEffect(() => {
    const state = location.state as { reference?: string } | null
    if (state?.reference) {
      setRefUrl(state.reference)
      navigate(location.pathname, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onPickReference(file: File | undefined) {
    setRefError('')
    if (!file) return
    try {
      setRefUrl(await fileToDataUrl(file))
    } catch {
      setRefError(d.create.image.referenceInvalid)
    }
  }

  async function runJob(job: ImgJob) {
    try {
      let body: { data?: ImageData[] }
      if (job.refUrl) {
        const blob = await imageUrlToBlob(job.refUrl)
        body = (await imageEdits({
          model: job.model,
          prompt: job.prompt,
          image: blob,
          n: job.n,
          size: job.size,
        })) as { data?: ImageData[] }
      } else {
        body = (await imageGenerations({
          model: job.model,
          prompt: job.prompt,
          n: job.n,
          size: job.size,
        })) as { data?: ImageData[] }
      }
      const urls: string[] = []
      for (const item of body.data || []) {
        if (item.url) urls.push(item.url)
        else if (item.b64_json) urls.push(`data:image/png;base64,${item.b64_json}`)
      }
      if (urls.length === 0) throw new Error('empty response')
      const saved: AssetRecord[] = []
      for (const url of urls) {
        saved.push(
          await addAsset({
            kind: 'image',
            title: job.prompt.slice(0, 80),
            model: job.model,
            prompt: job.prompt,
            payload: url,
            meta: { size: job.size, remix: !!job.refUrl },
          }),
        )
      }
      setAssets((prev) => [...saved, ...prev])
      setJobs((prev) => prev.filter((j) => j.id !== job.id))
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed'
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: 'error' as const, error: message } : j)),
      )
    }
  }

  function submitJob(input: Omit<ImgJob, 'id' | 'status'>) {
    const job: ImgJob = { ...input, id: jobId(), status: 'running' }
    setJobs((prev) => [job, ...prev])
    void runJob(job)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const text = prompt.trim()
    if (!text || !model) return
    submitJob({ prompt: text, model, size: aspect.size, n: count, refUrl: refUrl || undefined })
  }

  function retryJob(job: ImgJob) {
    setJobs((prev) => prev.filter((j) => j.id !== job.id))
    submitJob({ prompt: job.prompt, model: job.model, size: job.size, n: job.n, refUrl: job.refUrl })
  }

  /* Focus actions */

  function rerunAsset(asset: AssetRecord, vary: boolean) {
    const size = String(asset.meta?.size || aspect.size)
    submitJob({
      prompt: asset.prompt || asset.title,
      model: asset.model || model,
      size,
      n: 1,
      refUrl: vary ? asset.payload : undefined,
    })
    setFocus(null)
  }

  function useAsReference(asset: AssetRecord) {
    setRefUrl(asset.payload)
    setRefError('')
    setFocus(null)
    promptRef.current?.focus()
  }

  function makeVideo(asset: AssetRecord) {
    navigate('/create/video', {
      state: { frame: asset.payload, prompt: asset.prompt || asset.title },
    })
  }

  async function toggleFavorite(asset: AssetRecord) {
    const updated = await updateAsset(asset.id, { favorite: !asset.favorite })
    if (!updated) return
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? updated : a)))
    setFocus((prev) => (prev?.id === asset.id ? updated : prev))
  }

  async function deleteAsset(asset: AssetRecord) {
    if (!window.confirm(d.create.assets.deleteConfirm)) return
    await removeAsset(asset.id)
    setAssets((prev) => prev.filter((a) => a.id !== asset.id))
    setFocus(null)
  }

  const galleryEmpty = jobs.length === 0 && assets.length === 0
  const aspectLabels = useMemo(
    () => ({
      square: d.create.aspect.square,
      landscape: d.create.aspect.landscape,
      portrait: d.create.aspect.portrait,
    }),
    [d],
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[340px_1fr]">
        {/* Composer */}
        <form onSubmit={onSubmit} className="bx-card h-fit space-y-4 p-5 lg:sticky lg:top-4">
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <ImageIcon size={17} className="text-[var(--bx-teal)]" />
            {d.create.image.title}
          </h1>
          <div>
            <label className="bx-label">{d.create.model.label}</label>
            <ModelPicker value={model} onChange={setModel} kind="image" />
          </div>
          <div>
            <label className="bx-label" htmlFor="img-prompt">
              {d.create.image.title}
            </label>
            <textarea
              id="img-prompt"
              ref={promptRef}
              className="bx-input min-h-[110px] text-sm"
              placeholder={d.create.image.promptPlaceholder}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
            />
          </div>

          {/* Reference image */}
          <div>
            <label className="bx-label">{d.create.image.reference}</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onPickReference(e.target.files?.[0])}
            />
            {refUrl ? (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--bx-teal)] bg-[var(--bx-active)] p-2">
                <img src={refUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <p className="min-w-0 flex-1 text-xs text-[var(--bx-teal)]">
                  {d.create.image.referenceActive}
                </p>
                <button
                  type="button"
                  onClick={() => setRefUrl('')}
                  className="rounded-lg p-1.5 text-[var(--bx-text-dim)] hover:text-[var(--bx-text)]"
                  aria-label={d.create.image.referenceRemove}
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
                {d.create.image.referenceAdd}
              </button>
            )}
            {refError ? <p className="mt-1.5 text-xs text-red-400">{refError}</p> : null}
          </div>

          <div>
            <label className="bx-label">{d.create.aspect.label}</label>
            <div className="flex flex-wrap gap-2">
              {ASPECTS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAspect(a)}
                  className={cx(
                    'rounded-xl border px-3 py-1.5 text-xs transition-colors',
                    aspect.key === a.key
                      ? 'border-[var(--bx-teal)] bg-[var(--bx-active)] text-[var(--bx-teal)]'
                      : 'border-[var(--bx-border-strong)] text-[var(--bx-text-muted)] hover:bg-[var(--bx-hover)]',
                  )}
                >
                  {a.ratio} · {aspectLabels[a.key]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="bx-label">{d.create.image.count}</label>
            <div className="flex gap-2">
              {COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={cx(
                    'h-9 w-9 rounded-xl border text-sm transition-colors',
                    count === n
                      ? 'border-[var(--bx-teal)] bg-[var(--bx-active)] text-[var(--bx-teal)]'
                      : 'border-[var(--bx-border-strong)] text-[var(--bx-text-muted)] hover:bg-[var(--bx-hover)]',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={!model} className="bx-btn bx-btn-primary w-full">
            <Sparkles size={15} />
            {d.create.image.generate}
          </button>
        </form>

        {/* Gallery feed */}
        <div>
          {galleryEmpty ? (
            <div className="bx-card flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
              <ImageIcon size={28} className="text-[var(--bx-text-dim)]" />
              <h2 className="text-base font-semibold">{d.create.image.emptyTitle}</h2>
              <p className="max-w-sm text-sm text-[var(--bx-text-dim)]">{d.create.image.emptyBody}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {jobs.map((job) =>
                job.status === 'running' ? (
                  Array.from({ length: job.n }).map((_, i) => (
                    <div
                      key={`${job.id}-${i}`}
                      className="bx-skeleton relative"
                      style={{ aspectRatio: sizeRatio(job.size) }}
                    >
                      <span className="absolute inset-x-2 bottom-2 flex items-center gap-1.5 truncate text-[11px] text-[var(--bx-text-dim)]">
                        <Loader2 size={11} className="shrink-0 animate-spin" />
                        {d.create.job.generating}
                      </span>
                    </div>
                  ))
                ) : (
                  <div
                    key={job.id}
                    className="bx-card flex flex-col items-center justify-center gap-2 p-4 text-center"
                    style={{ aspectRatio: sizeRatio(job.size) }}
                  >
                    <p className="text-xs font-medium text-red-400">{d.create.job.failed}</p>
                    <p className="line-clamp-2 max-w-full text-[11px] text-[var(--bx-text-dim)]" title={job.error}>
                      {job.error}
                    </p>
                    <div className="flex gap-1.5">
                      <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" onClick={() => retryJob(job)}>
                        <RefreshCw size={12} />
                        {d.create.job.retry}
                      </button>
                      <button
                        type="button"
                        className="bx-btn bx-btn-ghost bx-btn-sm"
                        onClick={() => setJobs((prev) => prev.filter((j) => j.id !== job.id))}
                      >
                        {d.create.job.dismiss}
                      </button>
                    </div>
                  </div>
                ),
              )}
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setFocus(asset)}
                  className="group relative overflow-hidden rounded-2xl border border-[var(--bx-border)] transition-transform hover:scale-[1.01]"
                >
                  <img src={asset.payload} alt="" className="h-full w-full object-cover" loading="lazy" />
                  {asset.favorite ? (
                    <Star
                      size={14}
                      className="absolute right-2 top-2 fill-[var(--bx-teal)] text-[var(--bx-teal)]"
                    />
                  ) : null}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6 text-left text-[11px] text-white/85 opacity-0 transition-opacity group-hover:opacity-100">
                    {asset.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Focus view */}
      <Modal open={!!focus} onClose={() => setFocus(null)} title={focus?.title} wide>
        {focus ? (
          <div className="space-y-4">
            <img src={focus.payload} alt="" className="mx-auto max-h-[58vh] rounded-xl" />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" onClick={() => rerunAsset(focus, false)}>
                <RefreshCw size={13} />
                {d.create.actions.rerun}
              </button>
              <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" onClick={() => rerunAsset(focus, true)}>
                <Shuffle size={13} />
                {d.create.actions.vary}
              </button>
              <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" onClick={() => useAsReference(focus)}>
                <ImagePlus size={13} />
                {d.create.actions.useAsReference}
              </button>
              <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" onClick={() => makeVideo(focus)}>
                <Clapperboard size={13} />
                {d.create.actions.makeVideo}
              </button>
              <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" onClick={() => void toggleFavorite(focus)}>
                <Star size={13} className={focus.favorite ? 'fill-[var(--bx-teal)] text-[var(--bx-teal)]' : undefined} />
                {focus.favorite ? d.create.actions.unfavorite : d.create.actions.favorite}
              </button>
              <a href={focus.payload} download target="_blank" rel="noopener" className="bx-btn bx-btn-ghost bx-btn-sm">
                <Download size={13} />
                {d.create.actions.download}
              </a>
              <button
                type="button"
                className="bx-btn bx-btn-ghost bx-btn-sm text-red-400"
                onClick={() => void deleteAsset(focus)}
              >
                <Trash2 size={13} />
                {d.create.actions.delete}
              </button>
            </div>
            <p className="text-center text-xs text-[var(--bx-text-dim)]">
              {focus.model}
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
