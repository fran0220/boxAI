import { useCallback, useEffect, useState } from 'react'
import { fetchModels, type GatewayModel } from './api'

export type ModelKind = 'chat' | 'image' | 'video'

const IMAGE_HINTS = [
  'dall-e',
  'gpt-image',
  'image',
  'flux',
  'stable-diffusion',
  'sd3',
  'sdxl',
  'cogview',
  'wanx',
  'seedream',
  'midjourney',
  'mj-',
  'imagen',
]

const VIDEO_HINTS = [
  'video',
  'sora',
  'veo',
  'kling',
  'runway',
  'pika',
  'hailuo',
  'cogvideo',
  'seedance',
  'wan2',
]

export function classifyModel(id: string): ModelKind {
  const lower = id.toLowerCase()
  if (VIDEO_HINTS.some((h) => lower.includes(h))) return 'video'
  if (IMAGE_HINTS.some((h) => lower.includes(h))) return 'image'
  return 'chat'
}

let cache: GatewayModel[] | null = null
let inflight: Promise<GatewayModel[]> | null = null

async function loadModels(force = false): Promise<GatewayModel[]> {
  if (cache && !force) return cache
  if (!inflight) {
    inflight = fetchModels()
      .then((models) => {
        cache = models
        return models
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export interface ModelsState {
  models: GatewayModel[]
  byKind: (kind: ModelKind) => string[]
  loading: boolean
  error: string
  reload: () => void
}

export function useModels(): ModelsState {
  const [models, setModels] = useState<GatewayModel[]>(cache || [])
  const [loading, setLoading] = useState(!cache)
  const [error, setError] = useState('')

  const load = useCallback((force: boolean) => {
    setLoading(true)
    setError('')
    loadModels(force)
      .then(setModels)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Model list failed'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!cache) load(false)
  }, [load])

  const byKind = useCallback(
    (kind: ModelKind) => models.filter((m) => classifyModel(m.id) === kind).map((m) => m.id),
    [models],
  )

  return { models, byKind, loading, error, reload: () => load(true) }
}
