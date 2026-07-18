import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ apiPut: vi.fn(), apiDelete: vi.fn(), user: { id: 1 } }))

vi.mock('./session', () => ({
  getSessionSnapshot: () => ({ status: 'authenticated', user: { id: mocks.user.id }, accessToken: 'memory-only' }),
}))
vi.mock('./api', () => ({
  apiGet: vi.fn(), apiPost: vi.fn(), apiPut: mocks.apiPut, apiDelete: mocks.apiDelete,
  withQuery: (path: string, params: Record<string, unknown>) => `${path}?${new URLSearchParams(params as Record<string, string>)}`,
}))

import { flushOutbox, mergeCloudRecords, readOutbox, stageObjectDelete, stageRecord } from './creator-cloud'

describe('creator cloud repository', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size },
    } satisfies Storage })
    localStorage.clear()
    vi.clearAllMocks()
    mocks.user.id = 1
  })

  it('strictly namespaces and deduplicates durable outboxes by account', () => {
    stageRecord({ kind: 'image_task', clientId: 'id-1', operation: 'upsert', payload: { value: 1 } })
    stageRecord({ kind: 'image_task', clientId: 'id-1', operation: 'upsert', payload: { value: 2 } })
    expect(readOutbox()).toHaveLength(1)
    const entry = readOutbox()[0]
		expect(entry.operation === 'upsert' ? entry.payload : undefined).toEqual({ value: 2 })
    mocks.user.id = 2
    expect(readOutbox()).toEqual([])
    stageRecord({ kind: 'asset', clientId: 'two', operation: 'delete' })
    mocks.user.id = 1
		expect(readOutbox()[0].clientId).toBe('id-1')
  })

  it('keeps pending local values and applies remote tombstones', () => {
    const local = [{ id: 'pending', value: 'local' }, { id: 'gone', value: 'old' }]
    const merged = mergeCloudRecords(local, [
			{ kind: 'image_task', client_id: 'pending', payload: { id: 'pending', value: 'remote' }, client_updated_at: '', revision: 2 },
			{ kind: 'image_task', client_id: 'gone', payload: { id: 'gone', value: 'remote' }, client_updated_at: '', revision: 3, deleted_at: 'now' },
		], [{ kind: 'image_task', clientId: 'pending', operation: 'upsert', payload: local[0], clientUpdatedAt: 'now' }])
    expect(merged.items).toEqual([{ id: 'pending', value: 'local' }])
    expect(merged.deletedIds).toEqual(['gone'])
  })

  it('replays an idempotent record mutation once using the shared contract kind', async () => {
    mocks.apiPut.mockResolvedValue({})
		stageRecord({ kind: 'image_task', clientId: 'id-1', operation: 'upsert', payload: { ok: true } })
    await flushOutbox()
    await flushOutbox()
    expect(mocks.apiPut).toHaveBeenCalledTimes(1)
		expect(mocks.apiPut.mock.calls[0][0]).toContain('/image_task/id-1')
    expect(readOutbox()).toEqual([])
  })

	it('durably retries object deletes through the same per-account outbox', async () => {
		mocks.apiDelete.mockResolvedValue({})
		stageObjectDelete('image-1')
		await flushOutbox()
		expect(mocks.apiDelete).toHaveBeenCalledWith('/api/v1/boxai/creator/objects/image-1')
		expect(readOutbox()).toEqual([])
	})
})
