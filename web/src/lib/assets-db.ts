/** Cloud-authoritative generation history with a per-account offline cache. */

import {
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
} from './creator-cloud'

export type AssetKind = 'image' | 'video'

export interface AssetRecord {
  id: string
  kind: AssetKind
  title: string
  createdAt: number
  model?: string
  prompt?: string
  /** Base64 data URL or remote URL */
  payload: string
  /** Stable R2 object client id. `payload` is only a short-lived display URL locally. */
  objectId?: string
  /** CORS fallback when an external URL cannot be copied to R2. */
  externalUrl?: string
  favorite?: boolean
  meta?: Record<string, unknown>
}

const DB_NAME = 'boxai-creator-assets'
// v3 drops the chat `sessions` store (Creator is image/video only)
const DB_VERSION = 3
const STORE = 'assets'
const LEGACY_SESSIONS_STORE = 'sessions'
const LS_KEY = 'boxai_creator_assets_v1'

function id(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(`${DB_NAME}:${creatorCacheNamespace()}`, DB_VERSION)
      req.onerror = () => resolve(null)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }
        if (db.objectStoreNames.contains(LEGACY_SESSIONS_STORE)) {
          db.deleteObjectStore(LEGACY_SESSIONS_STORE)
        }
      }
      req.onsuccess = () => resolve(req.result)
    } catch {
      resolve(null)
    }
  })
}

function lsAll(): AssetRecord[] {
  try {
    const raw = localStorage.getItem(`${LS_KEY}:${creatorCacheNamespace()}`)
    if (!raw) return []
    return JSON.parse(raw) as AssetRecord[]
  } catch {
    return []
  }
}

function lsSave(items: AssetRecord[]): void {
  localStorage.setItem(`${LS_KEY}:${creatorCacheNamespace()}`, JSON.stringify(items.slice(0, 200)))
}

/** Drops legacy v2 records whose kind is no longer supported (e.g. 'chat'). */
function knownKind(record: AssetRecord): boolean {
  return record.kind === 'image' || record.kind === 'video'
}

export async function listAssets(kind?: AssetKind): Promise<AssetRecord[]> {
  let local: AssetRecord[]
  const db = await openDb()
  if (!db) {
    local = lsAll().filter(knownKind)
  } else {
    local = await readDbAssets(db)
  }
  if (!local.length && creatorCacheNamespace() !== 'anonymous') {
    local = await readLegacyAssets()
    if (local.length) await saveAllLocal(local)
  }
  try {
    const snapshot = await getCloudSnapshot<AssetRecord>('asset')
    const merged = mergeCloudRecords(local, snapshot.records, readOutbox())
    merged.localOnly.forEach((asset) => { void migrateAsset(asset) })
    local = merged.items
    await saveAllLocal(local)
  } catch { /* local cache remains usable */ }
  const resolved = await Promise.all(local.map(async (asset) => {
    if (!asset.objectId) return { ...asset, payload: asset.externalUrl || asset.payload }
    try { return { ...asset, payload: await getCreatorObjectUrl(asset.objectId) } } catch { return asset }
  }))
  return (kind ? resolved.filter((a) => a.kind === kind) : resolved).sort((a, b) => b.createdAt - a.createdAt)
}

async function readLegacyAssets(): Promise<AssetRecord[]> {
  // The old unscoped repository belongs to the first account that claims it;
	// never copy the same private history into a second account namespace.
	const marker = `${DB_NAME}:legacy-claimed-by`
  if (localStorage.getItem(marker)) return []
  let records: AssetRecord[] = []
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) records = (JSON.parse(raw) as AssetRecord[]).filter(knownKind)
  } catch { /* IndexedDB migration can still succeed */ }
  if (!records.length) {
    const databases = await indexedDB.databases?.()
    if (!databases || databases.some((database) => database.name === DB_NAME)) {
      const legacy = await new Promise<IDBDatabase | null>((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(null)
      })
      if (legacy?.objectStoreNames.contains(STORE)) records = await readDbAssets(legacy)
      legacy?.close()
    }
  }
  localStorage.setItem(marker, creatorCacheNamespace())
  return records
}

function readDbAssets(db: IDBDatabase): Promise<AssetRecord[]> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    req.onsuccess = () => {
      resolve(((req.result as AssetRecord[]) || []).filter(knownKind))
    }
    req.onerror = () => resolve([])
  })
}

async function saveAllLocal(items: AssetRecord[]): Promise<void> {
  const db = await openDb()
  if (!db) { lsSave(items); return }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    store.clear()
    items.forEach((item) => store.put(item))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function cloudAssetPayload(asset: AssetRecord): AssetRecord {
  const { payload: _payload, ...metadata } = asset
  return { ...metadata, payload: '', externalUrl: asset.externalUrl }
}

async function migrateAsset(asset: AssetRecord): Promise<void> {
  let objectId = asset.objectId
  let externalUrl = asset.externalUrl
  if (!objectId && asset.payload) {
    try {
      const blob = await dataUrlToBlob(asset.payload)
      objectId = `asset-${asset.id}`
      await uploadCreatorObject(objectId, asset.kind, blob)
    } catch {
      // External URLs can be opaque/CORS-blocked. Keep the URL, never base64, as compatibility metadata.
      if (/^https?:/.test(asset.payload)) externalUrl = asset.payload
    }
  }
  const migrated = { ...asset, objectId, externalUrl }
  stageRecord({ kind: 'asset', clientId: asset.id, operation: 'upsert', payload: cloudAssetPayload(migrated) })
  void flushOutbox()
  await putLocalAsset(migrated)
}

async function putLocalAsset(record: AssetRecord): Promise<void> {
  const db = await openDb()
  if (!db) { lsSave([record, ...lsAll().filter((item) => item.id !== record.id)]); return }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function addAsset(
  input: Omit<AssetRecord, 'id' | 'createdAt'> & { id?: string; createdAt?: number },
): Promise<AssetRecord> {
  const record: AssetRecord = {
    id: input.id || id(),
    createdAt: input.createdAt || Date.now(),
    kind: input.kind,
    title: input.title,
    model: input.model,
    prompt: input.prompt,
    payload: input.payload,
    favorite: input.favorite,
    meta: input.meta,
  }
  await putLocalAsset(record)
  void migrateAsset(record).catch(() => undefined)
  return record
}

export async function updateAsset(
  assetId: string,
  patch: Partial<Pick<AssetRecord, 'title' | 'favorite' | 'meta'>>,
): Promise<AssetRecord | null> {
  const db = await openDb()
  if (!db) {
    const all = lsAll()
    const idx = all.findIndex((a) => a.id === assetId)
    if (idx === -1) return null
    all[idx] = { ...all[idx], ...patch }
    lsSave(all)
    stageRecord({ kind: 'asset', clientId: assetId, operation: 'upsert', payload: cloudAssetPayload(all[idx]) })
    void flushOutbox()
    return all[idx]
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const getReq = store.get(assetId)
    let updated: AssetRecord | null = null
    getReq.onsuccess = () => {
      const current = getReq.result as AssetRecord | undefined
      if (!current) return
      updated = { ...current, ...patch }
      store.put(updated)
    }
    tx.oncomplete = () => {
      if (updated) {
        stageRecord({ kind: 'asset', clientId: updated.id, operation: 'upsert', payload: cloudAssetPayload(updated) })
        void flushOutbox()
      }
      resolve(updated)
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function removeAsset(assetId: string): Promise<void> {
  const existing = (await listAssets()).find((item) => item.id === assetId)
  const db = await openDb()
  if (!db) {
    lsSave(lsAll().filter((a) => a.id !== assetId))
    stageRecord({ kind: 'asset', clientId: assetId, operation: 'delete' })
    if (existing?.objectId) stageObjectDelete(existing.objectId)
		void flushOutbox()
    return
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(assetId)
    tx.oncomplete = () => {
      stageRecord({ kind: 'asset', clientId: assetId, operation: 'delete' })
			if (existing?.objectId) stageObjectDelete(existing.objectId)
			void flushOutbox()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}
