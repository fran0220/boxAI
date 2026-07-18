import type { AgentConversation, TaskRecord, StoredImage, StoredImageThumbnail } from '../types'
import { getPg } from './pgI18n'
import {
  blobToDataUrl,
  creatorCacheNamespace,
  dataUrlToBlob,
  flushOutbox,
  getCloudSnapshot,
  getCreatorObjectUrl,
  mergeCloudRecords,
  readOutbox,
  stageRecord,
  stageObjectDelete,
  uploadCreatorObject,
	type CreatorRecordKind,
} from '@/lib/creator-cloud'

const DB_NAME = 'gpt-image-playground'
const DB_VERSION = 3
const STORE_TASKS = 'tasks'
const STORE_IMAGES = 'images'
const STORE_THUMBNAILS = 'thumbnails'
const STORE_AGENT_CONVERSATIONS = 'agentConversations'
const THUMBNAIL_MAX_SIZE = 720
const THUMBNAIL_QUALITY = 0.9
const THUMBNAIL_VERSION = 2
const legacyMigrations = new Map<string, Promise<void>>()

export const CURRENT_THUMBNAIL_VERSION = THUMBNAIL_VERSION

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // The cache is per-account. IDs are intentionally unchanged because tasks refer to them.
    const req = indexedDB.open(`${DB_NAME}:${creatorCacheNamespace()}`, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        db.createObjectStore(STORE_TASKS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_THUMBNAILS)) {
        db.createObjectStore(STORE_THUMBNAILS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_AGENT_CONVERSATIONS)) {
        db.createObjectStore(STORE_AGENT_CONVERSATIONS, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => {
      const db = req.result
      const namespace = creatorCacheNamespace()
      if (namespace === 'anonymous') { resolve(db); return }
      let migration = legacyMigrations.get(namespace)
      if (!migration) {
        migration = migrateLegacyDatabase(db, namespace)
        legacyMigrations.set(namespace, migration)
      }
      void migration.then(() => resolve(db), () => resolve(db))
    }
    req.onerror = () => reject(req.error)
  })
}

async function migrateLegacyDatabase(target: IDBDatabase, namespace: string): Promise<void> {
  // The unscoped database may contain one person's private history. Exactly
	// one authenticated account may claim it on this browser.
	const marker = `${DB_NAME}:legacy-claimed-by`
  if (localStorage.getItem(marker)) return
  const databases = await indexedDB.databases?.()
  if (databases && !databases.some((database) => database.name === DB_NAME)) {
    localStorage.setItem(marker, namespace)
    return
  }
  const legacy = await new Promise<IDBDatabase | null>((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
  if (!legacy) return
  for (const storeName of [STORE_TASKS, STORE_IMAGES, STORE_THUMBNAILS, STORE_AGENT_CONVERSATIONS]) {
    if (!legacy.objectStoreNames.contains(storeName)) continue
    const values = await new Promise<unknown[]>((resolve) => {
      const request = legacy.transaction(storeName).objectStore(storeName).getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve([])
    })
    if (!values.length) continue
    await new Promise<void>((resolve) => {
      const tx = target.transaction(storeName, 'readwrite')
      values.forEach((value) => tx.objectStore(storeName).put(value))
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  }
  legacy.close()
  localStorage.setItem(marker, namespace)
}

function dbTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const store = tx.objectStore(storeName)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

// ===== Tasks =====

async function syncRecords<T extends { id: string }>(kind: CreatorRecordKind, storeName: string, local: T[]): Promise<T[]> {
  try {
    const snapshot = await getCloudSnapshot<T>(kind)
    const merged = mergeCloudRecords(local, snapshot.records, readOutbox())
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      store.clear()
      merged.items.forEach((item) => store.put(item))
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    merged.localOnly.forEach((item) => stageRecord({ kind, clientId: item.id, operation: 'upsert', payload: item }))
    void flushOutbox()
    return merged.items
  } catch {
    return local
  }
}

export async function getAllTasks(): Promise<TaskRecord[]> {
  const local = await dbTransaction<TaskRecord[]>(STORE_TASKS, 'readonly', (s) => s.getAll())
  return syncRecords('image_task', STORE_TASKS, local)
}

export async function putTask(task: TaskRecord): Promise<IDBValidKey> {
  const result = await dbTransaction(STORE_TASKS, 'readwrite', (s) => s.put(task))
  stageRecord({ kind: 'image_task', clientId: task.id, operation: 'upsert', payload: task })
  void flushOutbox()
  return result
}

export async function deleteTask(id: string): Promise<undefined> {
  const result = await dbTransaction<undefined>(STORE_TASKS, 'readwrite', (s) => s.delete(id))
  stageRecord({ kind: 'image_task', clientId: id, operation: 'delete' })
  void flushOutbox()
  return result
}

export async function clearTasks(): Promise<undefined> {
  const tasks = await dbTransaction<TaskRecord[]>(STORE_TASKS, 'readonly', (s) => s.getAll())
  const result = await dbTransaction<undefined>(STORE_TASKS, 'readwrite', (s) => s.clear())
  tasks.forEach((task) => stageRecord({ kind: 'image_task', clientId: task.id, operation: 'delete' }))
  void flushOutbox()
  return result
}

// ===== Agent conversations =====

export async function getAllAgentConversations(): Promise<AgentConversation[]> {
  const local = await dbTransaction<AgentConversation[]>(STORE_AGENT_CONVERSATIONS, 'readonly', (s) => s.getAll())
  return syncRecords('agent_conversation', STORE_AGENT_CONVERSATIONS, local)
}

export function putAgentConversation(conversation: AgentConversation): Promise<IDBValidKey> {
  return dbTransaction(STORE_AGENT_CONVERSATIONS, 'readwrite', (s) => s.put(conversation)).then((result) => {
    stageRecord({ kind: 'agent_conversation', clientId: conversation.id, operation: 'upsert', payload: conversation })
    void flushOutbox()
    return result
  })
}

export async function clearAgentConversations(): Promise<undefined> {
  const conversations = await getAllLocalAgentConversations()
  const result = await dbTransaction<undefined>(STORE_AGENT_CONVERSATIONS, 'readwrite', (s) => s.clear())
  conversations.forEach((item) => stageRecord({ kind: 'agent_conversation', clientId: item.id, operation: 'delete' }))
  void flushOutbox()
  return result
}

export function replaceAgentConversations(conversations: AgentConversation[]): Promise<undefined> {
  return getAllLocalAgentConversations().then((previous) => openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_AGENT_CONVERSATIONS, 'readwrite')
        const store = tx.objectStore(STORE_AGENT_CONVERSATIONS)
        store.clear()
        for (const conversation of conversations) store.put(conversation)
        tx.oncomplete = () => {
          const nextIds = new Set(conversations.map((item) => item.id))
          previous.filter((item) => !nextIds.has(item.id)).forEach((item) => stageRecord({ kind: 'agent_conversation', clientId: item.id, operation: 'delete' }))
          conversations.forEach((item) => stageRecord({ kind: 'agent_conversation', clientId: item.id, operation: 'upsert', payload: item }))
          void flushOutbox()
          resolve(undefined)
        }
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  ))
}

function getAllLocalAgentConversations(): Promise<AgentConversation[]> {
  return dbTransaction(STORE_AGENT_CONVERSATIONS, 'readonly', (s) => s.getAll())
}

// ===== Images =====

export async function getImage(id: string): Promise<StoredImage | undefined> {
  const local = await dbTransaction<StoredImage | undefined>(STORE_IMAGES, 'readonly', (s) => s.get(id))
  if (local) return local
  try {
    const response = await fetch(await getCreatorObjectUrl(id))
    if (!response.ok) return undefined
    const image: StoredImage = { id, dataUrl: await blobToDataUrl(await response.blob()), createdAt: Date.now(), source: 'generated' }
    await putImageLocal(image)
    return image
  } catch {
    return undefined
  }
}

export function getStoredImageThumbnail(id: string): Promise<StoredImageThumbnail | undefined> {
  return dbTransaction(STORE_THUMBNAILS, 'readonly', (s) => s.get(id))
}

export async function getStoredFreshImageThumbnail(id: string): Promise<StoredImageThumbnail | undefined> {
  const thumbnail = await getStoredImageThumbnail(id)
  return thumbnail?.thumbnailVersion === THUMBNAIL_VERSION ? thumbnail : undefined
}

export function putImageThumbnail(thumbnail: StoredImageThumbnail): Promise<IDBValidKey> {
  return dbTransaction(STORE_THUMBNAILS, 'readwrite', (s) => s.put(thumbnail))
}

export async function getImageThumbnail(id: string): Promise<StoredImageThumbnail | undefined> {
  const existingThumbnail = await getStoredImageThumbnail(id)
  if (existingThumbnail?.thumbnailVersion === THUMBNAIL_VERSION) {
    const image = await getImage(id)
    if (image && (!image.width || !image.height) && existingThumbnail.width && existingThumbnail.height) {
      await putImage({ ...image, width: existingThumbnail.width, height: existingThumbnail.height })
    }
    return existingThumbnail
  }

  const image = await getImage(id)
  if (!image) return undefined
  const legacyImage = image as StoredImage & Partial<StoredImageThumbnail>
  if (legacyImage.thumbnailDataUrl && legacyImage.thumbnailVersion === THUMBNAIL_VERSION) {
    const thumbnail: StoredImageThumbnail = {
      id,
      thumbnailDataUrl: legacyImage.thumbnailDataUrl,
      width: legacyImage.width,
      height: legacyImage.height,
      thumbnailVersion: THUMBNAIL_VERSION,
    }
    await putImageThumbnail(thumbnail)
    if ((!image.width || !image.height) && thumbnail.width && thumbnail.height) {
      await putImage({ ...image, width: thumbnail.width, height: thumbnail.height })
    }
    return thumbnail
  }

  const metadata = await safeCreateImageThumbnail(image.dataUrl)
  if (!metadata.thumbnailDataUrl) return undefined
  const thumbnail: StoredImageThumbnail = {
    id,
    thumbnailDataUrl: metadata.thumbnailDataUrl,
    width: metadata.width,
    height: metadata.height,
    thumbnailVersion: THUMBNAIL_VERSION,
  }
  await putImageThumbnail(thumbnail)
  if (metadata.width && metadata.height && (image.width !== metadata.width || image.height !== metadata.height)) {
    await putImage({ ...image, width: metadata.width, height: metadata.height })
  }
  return thumbnail
}

export function getAllImages(): Promise<StoredImage[]> {
  return dbTransaction(STORE_IMAGES, 'readonly', (s) => s.getAll())
}

export function getAllImageIds(): Promise<string[]> {
  return dbTransaction(STORE_IMAGES, 'readonly', (s) => s.getAllKeys()).then((keys) =>
    keys.map(String),
  )
}

export function putImage(image: StoredImage): Promise<IDBValidKey> {
  return putImageLocal(image).then((result) => {
    queueImageUpload(image)
    return result
  })
}

function putImageLocal(image: StoredImage): Promise<IDBValidKey> {
  return dbTransaction(STORE_IMAGES, 'readwrite', (s) => s.put(image))
}

const queuedImageUploads = new Set<string>()
let activeImageUploads = 0
const imageUploadQueue: StoredImage[] = []
const imageUploadRetries = new Map<string, number>()

function queueImageUpload(image: StoredImage): void {
	if (hasPendingObjectDelete(image.id)) return
  if (queuedImageUploads.has(image.id)) return
  queuedImageUploads.add(image.id)
  imageUploadQueue.push(image)
  drainImageUploads()
}

function hasPendingObjectDelete(id: string): boolean {
	return readOutbox().some((entry) => entry.operation === 'delete_object' && entry.clientId === id)
}

function drainImageUploads(): void {
  while (activeImageUploads < 2 && imageUploadQueue.length) {
    const image = imageUploadQueue.shift()!
    activeImageUploads++
		let uploaded = false
    void dataUrlToBlob(image.dataUrl)
      .then((blob) => uploadCreatorObject(image.id, 'image', blob, { width: image.width, height: image.height }))
      .then(() => { uploaded = true })
			.catch(() => undefined)
      .finally(() => {
        activeImageUploads--
        queuedImageUploads.delete(image.id)
				if (uploaded || hasPendingObjectDelete(image.id)) {
					const retry = imageUploadRetries.get(image.id)
					if (retry) window.clearTimeout(retry)
					imageUploadRetries.delete(image.id)
				} else if (typeof window !== 'undefined' && !imageUploadRetries.has(image.id)) {
					const retry = window.setTimeout(() => {
						imageUploadRetries.delete(image.id)
						queueImageUpload(image)
					}, 30_000)
					imageUploadRetries.set(image.id, retry)
				}
        drainImageUploads()
      })
  }
}

/** Progressive, upload-only migration; never downloads the remote image set. */
export async function migrateLocalImagesToCloud(): Promise<void> {
  const images = await getAllImages()
  try {
    const snapshot = await getCloudSnapshot()
    const pendingDeletes = new Set(readOutbox().filter((entry) => entry.operation === 'delete_object').map((entry) => entry.clientId))
    const deletedIds = new Set(snapshot.objects.filter((object) => object.deleted_at).map((object) => object.client_id))
		await Promise.all(images.filter((image) => deletedIds.has(image.id)).map((image) => deleteImageLocal(image.id)))
		const remoteIds = new Set(snapshot.objects.filter((object) => !object.deleted_at).map((object) => object.client_id))
		images.filter((image) => !remoteIds.has(image.id) && !deletedIds.has(image.id) && !pendingDeletes.has(image.id)).forEach(queueImageUpload)
  } catch {
    // Offline: normal writes remain cached; the next authenticated startup retries migration.
  }
}

export function deleteImage(id: string): Promise<undefined> {
	return deleteImageLocal(id).then((result) => {
		const retry = imageUploadRetries.get(id)
		if (retry) window.clearTimeout(retry)
		imageUploadRetries.delete(id)
		for (let i = imageUploadQueue.length - 1; i >= 0; i--) {
			if (imageUploadQueue[i].id === id) imageUploadQueue.splice(i, 1)
		}
		queuedImageUploads.delete(id)
		stageObjectDelete(id)
		void flushOutbox()
		return result
	})
}

function deleteImageLocal(id: string): Promise<undefined> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_IMAGES, STORE_THUMBNAILS], 'readwrite')
        tx.objectStore(STORE_IMAGES).delete(id)
        tx.objectStore(STORE_THUMBNAILS).delete(id)
        tx.oncomplete = () => resolve(undefined)
        tx.onerror = () => reject(tx.error)
      }),
  )
}

export function clearImages(): Promise<undefined> {
  return getAllImageIds().then((ids) => openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_IMAGES, STORE_THUMBNAILS], 'readwrite')
        tx.objectStore(STORE_IMAGES).clear()
        tx.objectStore(STORE_THUMBNAILS).clear()
        tx.oncomplete = () => {
					ids.forEach(stageObjectDelete)
					void flushOutbox()
					resolve(undefined)
				}
        tx.onerror = () => reject(tx.error)
      }),
	))
}

// ===== Image hashing & dedup =====

export async function hashDataUrl(dataUrl: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    return hashDataUrlFallback(dataUrl)
  }

  const data = new TextEncoder().encode(dataUrl)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hashDataUrlFallback(dataUrl: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193

  for (let i = 0; i < dataUrl.length; i++) {
    const code = dataUrl.charCodeAt(i)
    h1 ^= code
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= code
    h2 = Math.imul(h2, 0x27d4eb2d)
  }

  return `fallback-${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`
}

export interface StoreImageResult {
  id: string
  width?: number
  height?: number
}

/**
 * Store image; skip if hash already exists.
 * … image id …。
 */
export async function storeImage(dataUrl: string, source: NonNullable<StoredImage['source']> = 'upload'): Promise<string> {
  return (await storeImageWithSize(dataUrl, source)).id
}

export async function storeImageWithSize(dataUrl: string, source: NonNullable<StoredImage['source']> = 'upload'): Promise<StoreImageResult> {
  const id = await hashDataUrl(dataUrl)
  const existing = await getImage(id)
  if (!existing) {
    const thumbnail = await safeCreateImageThumbnail(dataUrl)
    await putImage({
      id,
      dataUrl,
      createdAt: Date.now(),
      source,
      width: thumbnail.width,
      height: thumbnail.height,
    })
    if (thumbnail.thumbnailDataUrl) {
      await putImageThumbnail({
        id,
        thumbnailDataUrl: thumbnail.thumbnailDataUrl,
        width: thumbnail.width,
        height: thumbnail.height,
        thumbnailVersion: THUMBNAIL_VERSION,
      })
    }
    return { id, width: thumbnail.width, height: thumbnail.height }
  }

  if ((await getStoredImageThumbnail(id))?.thumbnailVersion !== THUMBNAIL_VERSION) {
    const thumbnail = await safeCreateImageThumbnail(existing.dataUrl)
    const width = thumbnail.width ?? existing.width
    const height = thumbnail.height ?? existing.height
    if (thumbnail.width && thumbnail.height && (existing.width !== thumbnail.width || existing.height !== thumbnail.height)) {
      await putImage({ ...existing, width: thumbnail.width, height: thumbnail.height })
    }
    if (thumbnail.thumbnailDataUrl) {
      await putImageThumbnail({
        id,
        thumbnailDataUrl: thumbnail.thumbnailDataUrl,
        width: thumbnail.width,
        height: thumbnail.height,
        thumbnailVersion: THUMBNAIL_VERSION,
      })
    }
    return { id, width, height }
  }
  return { id, width: existing.width, height: existing.height }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(getPg().imageLoadFailed))
    image.src = dataUrl
  })
}

async function createImageThumbnail(dataUrl: string): Promise<Omit<StoredImageThumbnail, 'id'>> {
  const image = await loadImage(dataUrl)
  const width = image.naturalWidth
  const height = image.naturalHeight
  if (width <= 0 || height <= 0) throw new Error(getPg().invalidImageSize)

  const scale = Math.min(1, THUMBNAIL_MAX_SIZE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(getPg().canvasUnsupported)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  return {
    thumbnailDataUrl: canvas.toDataURL('image/webp', THUMBNAIL_QUALITY),
    width,
    height,
    thumbnailVersion: THUMBNAIL_VERSION,
  }
}

async function safeCreateImageThumbnail(dataUrl: string): Promise<Partial<Omit<StoredImageThumbnail, 'id'>>> {
  try {
    return await createImageThumbnail(dataUrl)
  } catch {
    return {}
  }
}
