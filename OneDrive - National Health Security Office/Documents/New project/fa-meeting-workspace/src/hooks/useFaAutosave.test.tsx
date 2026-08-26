import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MeetingGroup } from '../domain/group'
import type { Issue } from '../domain/issue'
import { FaRepositoryError } from '../services/httpFaRepository'
import type { OfflineMutationQueue } from '../services/offline/offlineQueue'
import { FakeFaRepository } from '../test/fakeFaRepository'
import { useFaAutosave } from './useFaAutosave'

const originalGroup: MeetingGroup = {
  id: '10000000-0000-4000-8000-000000000001', meetingId: '00000000-0000-4000-8000-000000000001',
  groupNo: 1, groupName: 'กลุ่มหนึ่ง', groupDescription: '', presenter: '', status: 'draft',
  rowVersion: 1, finalizedAt: null, createdAt: '2026-08-27T01:00:00.000Z', updatedAt: '2026-08-27T01:00:00.000Z',
}
const issue: Issue = {
  id: '40000000-0000-4000-8000-000000000001', groupId: originalGroup.id, sortOrder: 1,
  topic: '', findings: '', proposal: '', actionPlan: '', monitoring: '', stakeholderRoles: '', rowVersion: 1,
  createdAt: originalGroup.createdAt, updatedAt: originalGroup.updatedAt,
}

afterEach(() => vi.useRealTimers())

describe('useFaAutosave', () => {
  it('serializes edits to the same record while the previous save is still pending', async () => {
    vi.useFakeTimers()
    const repository = new FakeFaRepository()
    let resolveFirst!: (issue: Issue) => void
    const firstSave = new Promise<Issue>((resolve) => { resolveFirst = resolve })
    const upsert = vi.spyOn(repository, 'upsertIssue')
      .mockImplementationOnce(() => firstSave)
    const queue = { enqueue: vi.fn(), flush: vi.fn() } as unknown as OfflineMutationQueue
    const { rerender } = renderHook(
      ({ issues }) => useFaAutosave({ group: originalGroup, issues, repository, queue, delayMs: 100 }),
      { initialProps: { issues: [issue] } },
    )

    const firstEdit = { ...issue, topic: 'แก้ไขครั้งแรก', updatedAt: '2026-08-27T01:01:00.000Z' }
    rerender({ issues: [firstEdit] })
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(upsert).toHaveBeenCalledTimes(1)

    const secondEdit = { ...firstEdit, topic: 'แก้ไขระหว่างรอบันทึก', updatedAt: '2026-08-27T01:02:00.000Z' }
    rerender({ issues: [secondEdit] })
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(upsert).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirst({ ...firstEdit, rowVersion: 2 })
      await firstSave
    })
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(upsert).toHaveBeenCalledTimes(2)
  })

  it('queues an uncertain untyped failure so the draft is not stranded in memory', async () => {
    vi.useFakeTimers()
    const repository = new FakeFaRepository()
    vi.spyOn(repository, 'upsertIssue').mockRejectedValue(new Error('INVALID_RESPONSE'))
    const enqueue = vi.fn().mockResolvedValue(undefined)
    const queue = { enqueue, flush: vi.fn() } as unknown as OfflineMutationQueue
    const { rerender, result } = renderHook(
      ({ issues }) => useFaAutosave({ group: originalGroup, issues, repository, queue, delayMs: 100 }),
      { initialProps: { issues: [issue] } },
    )

    rerender({ issues: [{ ...issue, topic: 'ต้องไม่สูญหาย' }] })
    await act(() => vi.advanceTimersByTimeAsync(100))

    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      groupId: originalGroup.id,
      targetKey: `issue:${issue.id}`,
      kind: 'issue_upsert',
    }))
    expect(result.current.state).toBe('unsynced')
  })

  it('saves only changed records and accepts the server version as its new baseline', async () => {
    vi.useFakeTimers()
    const repository = new FakeFaRepository()
    const saveGroup = vi.spyOn(repository, 'saveGroup')
    const queue = { enqueue: vi.fn(), flush: vi.fn() } as unknown as OfflineMutationQueue
    const { rerender, result } = renderHook(
      ({ group }) => useFaAutosave({ group, issues: [issue], repository, queue, delayMs: 100 }),
      { initialProps: { group: originalGroup } },
    )

    rerender({ group: { ...originalGroup, presenter: 'ผู้แทนกลุ่ม' } })
    await act(() => vi.advanceTimersByTimeAsync(100))

    expect(saveGroup).toHaveBeenCalledTimes(1)
    expect(result.current.state).toBe('saved')
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(saveGroup).toHaveBeenCalledTimes(1)
  })

  it('queues a retryable write and reports an unsynced offline draft', async () => {
    vi.useFakeTimers()
    const repository = new FakeFaRepository()
    vi.spyOn(repository, 'upsertIssue').mockRejectedValue(new FaRepositoryError('NETWORK_UNAVAILABLE', true))
    const enqueue = vi.fn().mockResolvedValue(undefined)
    const queue = { enqueue, flush: vi.fn() } as unknown as OfflineMutationQueue
    const { rerender, result } = renderHook(
      ({ issues }) => useFaAutosave({ group: originalGroup, issues, repository, queue, delayMs: 100 }),
      { initialProps: { issues: [issue] } },
    )

    rerender({ issues: [{ ...issue, topic: 'แก้ไขขณะออฟไลน์' }] })
    await act(() => vi.advanceTimersByTimeAsync(100))

    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      groupId: originalGroup.id,
      targetKey: `issue:${issue.id}`,
      kind: 'issue_upsert',
    }))
    expect(result.current.state).toBe('unsynced')
  })

  it('saves a drag-order change as one atomic reorder operation', async () => {
    vi.useFakeTimers()
    const repository = new FakeFaRepository()
    const reorder = vi.spyOn(repository, 'reorderIssues')
    const upsert = vi.spyOn(repository, 'upsertIssue')
    const queue = { enqueue: vi.fn(), flush: vi.fn() } as unknown as OfflineMutationQueue
    const second = { ...issue, id: '40000000-0000-4000-8000-000000000002', sortOrder: 2 }
    const { rerender } = renderHook(
      ({ issues }) => useFaAutosave({ group: originalGroup, issues, repository, queue, delayMs: 100 }),
      { initialProps: { issues: [issue, second] } },
    )

    rerender({ issues: [{ ...second, sortOrder: 1 }, { ...issue, sortOrder: 2 }] })
    await act(() => vi.advanceTimersByTimeAsync(100))

    expect(reorder).toHaveBeenCalledTimes(1)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('deletes first and then closes the remaining position gap atomically', async () => {
    vi.useFakeTimers()
    const repository = new FakeFaRepository()
    const remove = vi.spyOn(repository, 'deleteIssue')
    const reorder = vi.spyOn(repository, 'reorderIssues')
    const queue = { enqueue: vi.fn(), flush: vi.fn() } as unknown as OfflineMutationQueue
    const second = { ...issue, id: '40000000-0000-4000-8000-000000000002', sortOrder: 2 }
    const { rerender } = renderHook(
      ({ issues }) => useFaAutosave({ group: originalGroup, issues, repository, queue, delayMs: 100 }),
      { initialProps: { issues: [issue, second] } },
    )

    rerender({ issues: [{ ...second, sortOrder: 1 }] })
    await act(() => vi.advanceTimersByTimeAsync(100))

    expect(remove).toHaveBeenCalledTimes(1)
    expect(reorder).toHaveBeenCalledTimes(1)
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(reorder.mock.invocationCallOrder[0])
  })
})
