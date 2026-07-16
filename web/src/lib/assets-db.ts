/** Local generation history (IndexedDB with localStorage fallback). */

export type AssetKind = 'chat' | 'image' | 'video'

export interface AssetRecord {
  id: string
  kind: AssetKind
  title: string
  createdAt: number
  model?: string
  prompt?: string
  /** Base64 data URL, remote URL, or chat transcript JSON */
  payload: string
  meta?: Record<string, unknown>
}

const DB_NAME = 'boxai-creator-assets'
const STORE = 'assets'
const LS_KEY = 'boxai_creator_assets_v1'

function id(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onerror = () => resolve(null)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
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
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as AssetRecord[]
  } catch {
    return []
  }
}

function lsSave(items: AssetRecord[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, 200)))
}

export async function listAssets(kind?: AssetKind): Promise<AssetRecord[]> {
  const db = await openDb()
  if (!db) {
    const all = lsAll()
    return (kind ? all.filter((a) => a.kind === kind) : all).sort((a, b) => b.createdAt - a.createdAt)
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    req.onsuccess = () => {
      let items = (req.result as AssetRecord[]) || []
      if (kind) items = items.filter((a) => a.kind === kind)
      items.sort((a, b) => b.createdAt - a.createdAt)
      resolve(items)
    }
    req.onerror = () => resolve([])
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
    meta: input.meta,
  }
  const db = await openDb()
  if (!db) {
    const all = lsAll()
    all.unshift(record)
    lsSave(all)
    return record
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record)
    tx.oncomplete = () => resolve(record)
    tx.onerror = () => reject(tx.error)
  })
}

export async function removeAsset(assetId: string): Promise<void> {
  const db = await openDb()
  if (!db) {
    lsSave(lsAll().filter((a) => a.id !== assetId))
    return
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(assetId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
