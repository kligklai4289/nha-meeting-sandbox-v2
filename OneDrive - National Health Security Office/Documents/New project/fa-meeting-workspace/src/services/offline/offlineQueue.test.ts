import { describe, expect, it } from 'vitest'
import { FaRepositoryError } from '../httpFaRepository'
import {
  OfflineMutationQueue,
  type OfflineMutation,
  type OfflineMutationStore,
} from './offlineQueue'

class MemoryStore implements OfflineMutationStore {
  readonly values = new Map<string, OfflineMutation>()

  async put(mutation: OfflineMutation): Promise<void> { this.values.set(mutation.id, mutation) }
  async remove(id: string): Promise<void> { this.values.delete(id) }
  async list(): Promise<OfflineMutation[]> { return [...this.values.values()] }
}

function mutation(id: string, targetKey: string, createdAt: string): OfflineMutation {
  return {
    id,
    groupId: '10000000-0000-4000-8000-000000000001',
    targetKey,
    kind: 'issue_upsert',
    payload: { topic: id },
    createdAt,
  }
}

describe('OfflineMutationQueue', () => {
  it('flushes mutations oldest-first and removes only successful entries', async () => {
    const store = new MemoryStore()
    const queue = new OfflineMutationQueue(store)
    await queue.enqueue(mutation('b', 'issue:b', '2026-08-27T01:00:02.000Z'))
    await queue.enqueue(mutation('a', 'issue:a', '2026-08-27T01:00:01.000Z'))
    const order: string[] = []

    const result = await queue.flush(async (item) => { order.push(item.id) })

    expect(order).toEqual(['a', 'b'])
    expect(result).toEqual({ completed: 2, conflicts: [], pending: 0, offline: false })
    expect(await store.list()).toEqual([])
  })

  it('keeps the failed and later mutations when the network is unavailable', async () => {
    const store = new MemoryStore()
    const queue = new OfflineMutationQueue(store)
    await queue.enqueue(mutation('a', 'issue:a', '2026-08-27T01:00:01.000Z'))
    await queue.enqueue(mutation('b', 'issue:b', '2026-08-27T01:00:02.000Z'))

    const result = await queue.flush(async () => {
      throw new FaRepositoryError('NETWORK_UNAVAILABLE', true)
    })

    expect(result).toEqual({ completed: 0, conflicts: [], pending: 2, offline: true })
    expect((await store.list()).map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('blocks only the conflicted record and continues syncing other records', async () => {
    const store = new MemoryStore()
    const queue = new OfflineMutationQueue(store)
    await queue.enqueue(mutation('a1', 'issue:a', '2026-08-27T01:00:01.000Z'))
    await queue.enqueue(mutation('a2', 'issue:a', '2026-08-27T01:00:02.000Z'))
    await queue.enqueue(mutation('b1', 'issue:b', '2026-08-27T01:00:03.000Z'))
    const attempted: string[] = []

    const result = await queue.flush(async (item) => {
      attempted.push(item.id)
      if (item.id === 'a1') throw new FaRepositoryError('VERSION_CONFLICT')
    })

    expect(attempted).toEqual(['a1', 'b1'])
    expect(result).toEqual({ completed: 1, conflicts: ['issue:a'], pending: 2, offline: false })
    expect((await store.list()).map((item) => item.id)).toEqual(['a1', 'a2'])
  })

  it('flushes only the group bound to the current FA session', async () => {
    const store = new MemoryStore()
    const queue = new OfflineMutationQueue(store)
    const current = mutation('a', 'issue:a', '2026-08-27T01:00:01.000Z')
    const another = { ...mutation('b', 'issue:b', '2026-08-27T01:00:02.000Z'), groupId: '10000000-0000-4000-8000-000000000002' }
    await queue.enqueue(current)
    await queue.enqueue(another)
    const attempted: string[] = []

    const result = await queue.flush(async (item) => { attempted.push(item.id) }, current.groupId)

    expect(attempted).toEqual(['a'])
    expect(result.pending).toBe(0)
    expect((await store.list()).map((item) => item.id)).toEqual(['b'])
  })
})
