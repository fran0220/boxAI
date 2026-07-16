import { FormEvent, useState } from 'react'
import { imageGenerations, ApiError } from '@/lib/api'
import { addAsset } from '@/lib/assets-db'

interface ImageData {
  url?: string
  b64_json?: string
}

export function ImageGen() {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('dall-e-3')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [images, setImages] = useState<string[]>([])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || busy) return
    setBusy(true)
    setError('')
    setImages([])
    try {
      const body = (await imageGenerations({
        model,
        prompt: prompt.trim(),
        n: 1,
        size: '1024x1024',
      })) as { data?: ImageData[] }
      const urls: string[] = []
      for (const item of body.data || []) {
        if (item.url) urls.push(item.url)
        else if (item.b64_json) urls.push(`data:image/png;base64,${item.b64_json}`)
      }
      setImages(urls)
      for (const url of urls) {
        await addAsset({
          kind: 'image',
          title: prompt.trim().slice(0, 80),
          model,
          prompt: prompt.trim(),
          payload: url,
        })
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
          <label className="bx-label" htmlFor="img-model">
            Model
          </label>
          <input
            id="img-model"
            className="bx-input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </div>
        <div>
          <label className="bx-label" htmlFor="img-prompt">
            Prompt
          </label>
          <textarea
            id="img-prompt"
            className="bx-input min-h-[100px]"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button type="submit" disabled={busy} className="bx-btn bx-btn-primary disabled:opacity-60">
          {busy ? 'Generating…' : 'Generate image'}
        </button>
      </form>
      {images.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {images.map((src) => (
            <a key={src.slice(0, 64)} href={src} target="_blank" rel="noopener" className="bx-card overflow-hidden">
              <img src={src} alt="" className="h-auto w-full object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
