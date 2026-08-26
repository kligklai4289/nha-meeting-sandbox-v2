import { describe, expect, it, vi } from 'vitest'
import { FakeFaRepository } from '../../test/fakeFaRepository'
import type { OfflineMutation } from './offlineQueue'
import { processOfflineMutation } from './faOfflineSync'

const issue = {
  id: '40000000-0000-4000-8000-000000000001', groupId: '10000000-0000-4000-8000-000000000001',
  sortOrder: 1, topic: 'หัวข้อ', findings: '', proposal: '', actionPlan: '', monitoring: '', stakeholderRoles: '',
  rowVersion: 1, createdAt: '2026-08-27T01:00:00.000Z', updatedAt: '2026-08-27T01:00:00.000Z',
}

function queued(kind: OfflineMutation['kind'], payload: Record<string, unknown>): OfflineMutation {
  return {
    id: '50000000-0000-4000-8000-000000000001', groupId: issue.groupId,
    targetKey: `issue:${issue.id}`, kind, payload, createdAt: issue.createdAt,
  }
}

describe('processOfflineMutation', () => {
  it('replays an issue with the original mutation id', async () => {
    const repository = new FakeFaRepository()
    const upsert = vi.spyOn(repository, 'upsertIssue')

    await processOfflineMutation(repository, queued('issue_upsert', { issue }))

    expect(upsert).toHaveBeenCalledWith(issue, '50000000-0000-4000-8000-000000000001')
  })

  it('rejects malformed local data instead of sending it', async () => {
    const repository = new FakeFaRepository()
    const upsert = vi.spyOn(repository, 'upsertIssue')

    await expect(processOfflineMutation(repository, queued('issue_upsert', { issue: 'invalid' })))
      .rejects.toThrow('INVALID_OFFLINE_MUTATION')
    expect(upsert).not.toHaveBeenCalled()
  })
})
