import { FormEvent, useEffect, useRef, useState } from 'react'
import { videoGenerations, videoStatus, ApiError } from '@/lib/api'
import { addAsset } from '@/lib/assets-db'

export function VideoGen() {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('grok-video')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  async function pollUntilDone(id: string) {
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      let attempts = 0
      pollRef.current = window.setInterval(async () => {
        attempts++
        try {
          const data = (await videoStatus(id)) as Record<string, unknown>
          const st = String(data.status || data.state || '')
          setStatus(st || `polling… (${attempts})`)
          if (['completed', 'succeeded', 'done', 'success'].includes(st.toLowerCase())) {
            if (pollRef.current) window.clearInterval(pollRef.current)
            resolve(data)
          }
          if (['failed', 'error', 'cancelled'].includes(st.toLowerCase())) {
            if (pollRef.current) window.clearInterval(pollRef.current)
            reject(new Error(st || 'Video failed'))
          }
          if (attempts > 120) {
            if (pollRef.current) window.clearInterval(pollRef.current)
            reject(new Error('Timed out waiting for video'))
          }
        } catch (e) {
          if (pollRef.current) window.clearInterval(pollRef.current)
          reject(e)
        }
      }, 3000)
    })
  }

  function extractUrl(data: Record<string, unknown>): string {
    if (typeof data.url === 'string') return data.url
    if (typeof data.video_url === 'string') return data.video_url
    const output = data.output as { url?: string } | undefined
    if (output?.url) return output.url
    const dataArr = data.data as Array<{ url?: string }> | undefined
    if (dataArr?.[0]?.url) return dataArr[0].url
    return ''
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || busy) return
    setBusy(true)
    setError('')
    setVideoUrl('')
    setStatus('submitting')
    try {
      const created = (await videoGenerations({
        model,
        prompt: prompt.trim(),
      })) as Record<string, unknown>
      const id = String(created.id || created.video_id || '')
      let finalData = created
      if (id && !extractUrl(created)) {
        setStatus('queued')
        finalData = await pollUntilDone(id)
      }
      const url = extractUrl(finalData)
      if (url) {
        setVideoUrl(url)
        await addAsset({
          kind: 'video',
          title: prompt.trim().slice(0, 80),
          model,
          prompt: prompt.trim(),
          payload: url,
          meta: { id },
        })
      } else {
        setStatus(JSON.stringify(finalData).slice(0, 200))
        setError('Video job finished but no URL was returned for this provider response shape.')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="bx-card space-y-4 p-6">
        <div>
          <label className="bx-label" htmlFor="vid-model">
            Model
          </label>
          <input
            id="vid-model"
            className="bx-input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </div>
        <div>
          <label className="bx-label" htmlFor="vid-prompt">
            Prompt
          </label>
          <textarea
            id="vid-prompt"
            className="bx-input min-h-[100px]"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
          />
        </div>
        {status ? (
          <p className="text-xs text-[var(--bx-text-dim)]">Status: {status}</p>
        ) : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button type="submit" disabled={busy} className="bx-btn bx-btn-primary disabled:opacity-60">
          {busy ? 'Working…' : 'Generate video'}
        </button>
      </form>
      {videoUrl ? (
        <div className="bx-card overflow-hidden p-2">
          <video src={videoUrl} controls className="w-full rounded-lg" />
        </div>
      ) : null}
    </div>
  )
}
