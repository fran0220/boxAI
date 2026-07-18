import { apiDelete, apiGet, apiPost, apiPut, withQuery } from './api'
import { getSessionSnapshot } from './session'

export const CREATOR_RECORD_KINDS = ['image_task', 'agent_conversation', 'video_job', 'asset', 'project'] as const
export type CreatorRecordKind = (typeof CREATOR_RECORD_KINDS)[number]
export type CreatorObjectKind = 'image' | 'video' | 'audio' | 'asset'

export interface CloudRecord<T = unknown> {
  kind: CreatorRecordKind
  client_id: string
  payload: T
  client_updated_at: string
  revision: number
  deleted_at?: string
}

export interface CloudObject {
  client_id: string
  kind: string
  mime_type: string
  size_bytes: number
  width?: number
  height?: number
  status: string
  deleted_at?: string
}

export interface CloudSnapshot<T = unknown> {
  records: CloudRecord<T>[]
  objects: CloudObject[]
}

export interface RecordOutboxEntry {
  kind: CreatorRecordKind
  clientId: string
  operation: 'upsert' | 'delete'
  payload?: unknown
  clientUpdatedAt: string
}

export interface ObjectDeleteOutboxEntry {
  kind: 'object'
  clientId: string
  operation: 'delete_object'
  clientUpdatedAt: string
}

export type OutboxEntry = RecordOutboxEntry | ObjectDeleteOutboxEntry

const ROOT = '/api/v1/boxai/creator'
const OUTBOX_PREFIX = 'boxai_creator_cloud_outbox_v1:'
let flushing: Promise<void> | null = null
const activeObjectUploads = new Set<string>()

export function currentCreatorUserId(): string | null {
  const session = getSessionSnapshot()
  return session.status === 'authenticated' && session.user ? String(session.user.id) : null
}

export function creatorCacheNamespace(): string {
  return currentCreatorUserId() ?? 'anonymous'
}

function outboxKey(userId: string): string {
  return `${OUTBOX_PREFIX}${userId}`
}

export function readOutbox(userId = currentCreatorUserId()): OutboxEntry[] {
  if (!userId || typeof localStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(outboxKey(userId)) || '[]')
		if (!Array.isArray(parsed)) return []
		return parsed.filter(isOutboxEntry)
  } catch {
    return []
  }
}

function isOutboxEntry(value: unknown): value is OutboxEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as {
		kind?: unknown
		clientId?: unknown
		operation?: unknown
		clientUpdatedAt?: unknown
	}
  if (typeof entry.clientId !== 'string' || typeof entry.clientUpdatedAt !== 'string') return false
  if (entry.operation === 'delete_object') return entry.kind === 'object'
  return (entry.operation === 'upsert' || entry.operation === 'delete')
    && CREATOR_RECORD_KINDS.includes(entry.kind as CreatorRecordKind)
}

function writeOutbox(userId: string, entries: OutboxEntry[]): void {
  localStorage.setItem(outboxKey(userId), JSON.stringify(entries))
}

export function stageRecord(entry: Omit<RecordOutboxEntry, 'clientUpdatedAt'> & {
  clientUpdatedAt?: string
}): void {
  const userId = currentCreatorUserId()
  if (!userId || typeof localStorage === 'undefined') return
  const next: OutboxEntry = { ...entry, clientUpdatedAt: entry.clientUpdatedAt ?? new Date().toISOString() }
  const entries = readOutbox(userId).filter((item) => !(item.kind === next.kind && item.clientId === next.clientId))
  entries.push(next)
  writeOutbox(userId, entries)
}

export function stageObjectDelete(clientId: string): void {
  const userId = currentCreatorUserId()
  if (!userId || typeof localStorage === 'undefined') return
  const next: OutboxEntry = {
    kind: 'object',
    clientId,
    operation: 'delete_object',
    clientUpdatedAt: new Date().toISOString(),
  }
  const entries = readOutbox(userId).filter((item) => !(item.kind === next.kind && item.clientId === next.clientId))
  entries.push(next)
  writeOutbox(userId, entries)
}

function cancelStagedObjectDelete(userId: string, clientId: string): void {
  const remaining = readOutbox(userId).filter((entry) => !(
    entry.operation === 'delete_object' && entry.clientId === clientId
  ))
  writeOutbox(userId, remaining)
}

function recordPath(kind: CreatorRecordKind, clientId: string): string {
  return `${ROOT}/records/${encodeURIComponent(kind)}/${encodeURIComponent(clientId)}`
}

export async function flushOutbox(): Promise<void> {
  if (flushing) return flushing
  const userId = currentCreatorUserId()
  if (!userId) return
  flushing = (async () => {
    while (currentCreatorUserId() === userId) {
      let progressed = false
      const entries = readOutbox(userId)
			if (!entries.length) break
			for (const entry of entries) {
				if (currentCreatorUserId() !== userId) return
        if (entry.operation === 'delete_object' && activeObjectUploads.has(entry.clientId)) continue
				try {
					if (entry.operation === 'delete_object') {
						await apiDelete(`${ROOT}/objects/${encodeURIComponent(entry.clientId)}`)
					} else if (entry.operation === 'delete') {
						await apiDelete(recordPath(entry.kind, entry.clientId), { client_updated_at: entry.clientUpdatedAt })
          } else {
						await apiPut(recordPath(entry.kind, entry.clientId), { payload: entry.payload, client_updated_at: entry.clientUpdatedAt })
					}
					const remaining = readOutbox(userId).filter((item) => !(
						item.kind === entry.kind && item.clientId === entry.clientId && item.clientUpdatedAt === entry.clientUpdatedAt
					))
					writeOutbox(userId, remaining)
					progressed = true
				} catch {
					return
				}
			}
			if (!progressed) break
		}
  })().finally(() => { flushing = null })
  return flushing
}

export async function getCloudSnapshot<T = unknown>(kind?: CreatorRecordKind): Promise<CloudSnapshot<T>> {
  return apiGet(withQuery(`${ROOT}/snapshot`, { kind, include_deleted: true }))
}

/** Pending local mutations always win. Tombstones otherwise remove local data. */
export function mergeCloudRecords<T extends { id: string }>(
  local: T[], records: CloudRecord<T>[], pending: OutboxEntry[],
): { items: T[]; localOnly: T[]; deletedIds: string[] } {
  const byId = new Map(local.map((item) => [item.id, item]))
  const localIds = new Set(byId.keys())
  const pendingIds = new Set(pending.map((item) => `${item.kind}:${item.clientId}`))
  const deletedIds: string[] = []
  for (const remote of records) {
	localIds.delete(remote.client_id)
    if (pendingIds.has(`${remote.kind}:${remote.client_id}`)) continue
    if (remote.deleted_at) {
      byId.delete(remote.client_id)
      deletedIds.push(remote.client_id)
    } else if (remote.payload && typeof remote.payload === 'object') {
      byId.set(remote.client_id, { ...(remote.payload as T), id: remote.client_id })
    }
  }
  return {
	items: [...byId.values()],
	localOnly: local.filter((item) => localIds.has(item.id) && !pending.some((entry) => entry.clientId === item.id)),
	deletedIds,
	}
}

export async function uploadCreatorObject(
  clientId: string, kind: CreatorObjectKind, blob: Blob, dimensions?: { width?: number; height?: number },
): Promise<CloudObject> {
  const userId = currentCreatorUserId()
  activeObjectUploads.add(clientId)
  try {
    if (userId) cancelStagedObjectDelete(userId, clientId)
    // If a delete for this object already reached the network, let it finish
    // before starting the replacement upload so the new bytes always win.
    if (flushing) await flushing
    if (!userId || currentCreatorUserId() !== userId) {
      throw new Error('Creator account changed before object upload')
    }
    const path = `${ROOT}/objects/${encodeURIComponent(clientId)}`
		const created = await apiPost<{ object: CloudObject; upload_url?: string; already_ready: boolean; expires_in: number }>(`${path}/upload`, {
			kind, mime_type: blob.type || 'application/octet-stream', size_bytes: blob.size, ...dimensions,
		})
		if (created.already_ready) return created.object
		if (!created.upload_url) throw new Error('Creator cloud did not return an upload URL')
		const uploaded = await fetch(created.upload_url, { method: 'PUT', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob })
		if (!uploaded.ok) throw new Error(`Object upload failed (${uploaded.status})`)
		return apiPost<CloudObject>(`${path}/complete`)
	} finally {
		activeObjectUploads.delete(clientId)
		const currentFlush = flushing
		if (currentFlush) void currentFlush.finally(() => { void flushOutbox() })
		else void flushOutbox()
	}
}

export async function getCreatorObjectUrl(clientId: string): Promise<string> {
  const result = await apiGet<{ url: string; expires_in: number }>(`${ROOT}/objects/${encodeURIComponent(clientId)}/url`)
  return result.url
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(value: string): Promise<Blob> {
  const response = await fetch(value)
  if (!response.ok) throw new Error('Unable to read media')
  return response.blob()
}
