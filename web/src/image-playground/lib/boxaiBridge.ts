/**
 * Bridge between gpt_image_playground store and BoxAI Creator surfaces
 * (assets library, cross-route reference handoff, make-video).
 */

import { addAsset, listAssets } from '@/lib/assets-db'
import { getImage, storeImage } from './db'
import { useStore } from '../store'
import type { TaskRecord } from '../types'

const mirroredTaskImageKeys = new Set<string>()

function taskImageKey(taskId: string, imageId: string): string {
  return `${taskId}:${imageId}`
}

/** Mirror completed gallery tasks into BoxAI assets-db (for /create/assets). */
export async function mirrorTaskOutputsToAssets(task: TaskRecord): Promise<void> {
  if (task.status !== 'done' || !task.outputImages?.length) return
  // Skip agent-synced tasks if marked (agent tasks still have useful outputs)
  for (const imageId of task.outputImages) {
    const key = taskImageKey(task.id, imageId)
    if (mirroredTaskImageKeys.has(key)) continue
    mirroredTaskImageKeys.add(key)
    try {
      const image = await getImage(imageId)
      if (!image?.dataUrl) continue
      await addAsset({
        kind: 'image',
        title: (task.prompt || 'Image').slice(0, 80),
        model: task.apiModel,
        prompt: task.prompt,
        payload: image.dataUrl,
        meta: {
          size: task.params?.size,
          playgroundTaskId: task.id,
          playgroundImageId: imageId,
        },
      })
    } catch (err) {
      console.warn('[boxaiBridge] mirror asset failed', err)
      mirroredTaskImageKeys.delete(key)
    }
  }
}

/** Subscribe once; mirrors newly completed tasks. */
export function startAssetMirrorSubscription(): () => void {
  // Seed mirrored set with existing assets that already have playground keys
  void listAssets('image').then((assets) => {
    for (const a of assets) {
      const taskId = a.meta?.playgroundTaskId
      const imageId = a.meta?.playgroundImageId
      if (typeof taskId === 'string' && typeof imageId === 'string') {
        mirroredTaskImageKeys.add(taskImageKey(taskId, imageId))
      }
    }
  })

  let previous = useStore.getState().tasks
  return useStore.subscribe((state) => {
    const next = state.tasks
    if (next === previous) return
    const prevById = new Map(previous.map((t) => [t.id, t]))
    previous = next
    for (const task of next) {
      const before = prevById.get(task.id)
      if (task.status === 'done' && before?.status !== 'done') {
        void mirrorTaskOutputsToAssets(task)
      }
      // Also pick up partial image appends while already done
      if (task.status === 'done' && task.outputImages?.length) {
        const beforeCount = before?.outputImages?.length ?? 0
        if (task.outputImages.length > beforeCount) {
          void mirrorTaskOutputsToAssets(task)
        }
      }
    }
  })
}

/** Inject a reference data URL into the gallery composer. */
export async function injectReferenceDataUrl(dataUrl: string): Promise<void> {
  if (!dataUrl?.startsWith('data:') && !dataUrl?.startsWith('http') && !dataUrl?.startsWith('blob:')) {
    return
  }
  let resolved = dataUrl
  if (dataUrl.startsWith('http') || dataUrl.startsWith('blob:')) {
    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      resolved = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
    } catch (err) {
      console.warn('[boxaiBridge] failed to load reference URL', err)
      return
    }
  }
  const id = await storeImage(resolved, 'upload')
  useStore.getState().addInputImage({ id, dataUrl: resolved })
}
