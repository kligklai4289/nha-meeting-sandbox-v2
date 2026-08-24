import { describe, expect, it, vi } from 'vitest'
import type { Issue } from '../domain/issue'
import type { MeetingGroup } from '../domain/group'
import { FaRepositoryError, HttpFaRepository } from './httpFaRepository'

const groupId = '10000000-0000-4000-8000-000000000001'
const issue: Issue = {
  id: '40000000-0000-4000-8000-000000000001',
  groupId,
  sortOrder: 2,
  topic: 'ประเด็น',
  findings: 'ข้อค้นพบ',
  proposal: 'ข้อเสนอ',
  actionPlan: 'แผนงาน',
  monitoring: 'ติดตาม',
  stakeholderRoles: 'บทบาท',
  rowVersion: 3,
  createdAt: '2026-08-27T01:00:00.000+00:00',
  updatedAt: '2026-08-27T01:01:00.000+00:00',
}

const group: MeetingGroup = {
  id: groupId,
  meetingId: '00000000-0000-4000-8000-000000000001',
  groupNo: 1,
  groupName: 'บริหารกองทุน เหมาจ่าย',
  groupDescription: 'ขอบเขต',
  presenter: 'ผู้นำเสนอ',
  status: 'draft',
  rowVersion: 3,
  finalizedAt: null,
  createdAt: '2026-08-27T01:00:00.000Z',
  updatedAt: '2026-08-27T01:01:00.000Z',
}

const workspace = {
  meeting: {
    id: group.meetingId, title: 'การประชุม', fiscalYear: '2570',
    meetingDate: '2026-08-27', startTime: '09:00', endTime: '16:30',
    location: 'อยุธยา', status: 'active' as const, isActive: true,
    createdAt: group.createdAt, updatedAt: group.updatedAt,
  },
  group,
  issues: [issue],
}

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('HttpFaRepository', () => {
  it('exchanges a group code without retaining or returning the plaintext code', async () => {
    const accessCode = '3515'
    const fetcher = vi.fn().mockResolvedValue(response(200, {
      data: { meetingId: '00000000-0000-4000-8000-000000000001', groupId, expiresAt: '2026-08-27T13:00:00.000Z' },
      requestId: 'request-1',
    }))
    const repository = new HttpFaRepository(fetcher, () => '50000000-0000-4000-8000-000000000001')

    await expect(repository.createSession(groupId, accessCode)).resolves.toEqual({
      meetingId: '00000000-0000-4000-8000-000000000001', groupId, expiresAt: '2026-08-27T13:00:00.000Z',
    })
    expect(fetcher).toHaveBeenCalledWith('/api/fa/session', expect.objectContaining({
      method: 'POST', credentials: 'include', body: JSON.stringify({ groupId, accessCode }),
    }))
    expect(JSON.stringify(repository)).not.toContain(accessCode)
  })

  it('uses workspace data returned with the session without a second request', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, {
      data: {
        meetingId: group.meetingId,
        groupId,
        expiresAt: '2026-08-27T13:00:00.000Z',
        workspace,
      },
      requestId: 'request-fast-path',
    }))
    const repository = new HttpFaRepository(fetcher)

    await repository.createSession(groupId, '3515')
    await expect(repository.bootstrap()).resolves.toEqual(workspace)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith('/api/fa/session', expect.any(Object))
  })

  it('loads the existing bootstrap endpoint when session data has no workspace', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, {
        data: { meetingId: group.meetingId, groupId, expiresAt: '2026-08-27T13:00:00.000Z' },
        requestId: 'request-session-fallback',
      }))
      .mockResolvedValueOnce(response(200, {
        data: workspace,
        requestId: 'request-bootstrap-fallback',
      }))
    const repository = new HttpFaRepository(fetcher)

    await repository.createSession(groupId, '3515')
    await expect(repository.bootstrap()).resolves.toEqual(workspace)

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1]?.[0]).toBe('/api/fa/bootstrap')
  })

  it('sends a new issue with zero version, zero-based position, and a stable mutation id', async () => {
    const saved = { ...issue, rowVersion: 1 }
    const fetcher = vi.fn().mockResolvedValue(response(201, { data: saved, replayed: false, requestId: 'request-2' }))
    const repository = new HttpFaRepository(fetcher, () => '50000000-0000-4000-8000-000000000002')

    await expect(repository.upsertIssue({ ...issue, rowVersion: 0 })).resolves.toEqual(saved)
    expect(fetcher).toHaveBeenCalledWith('/api/fa/issues', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        mutationId: '50000000-0000-4000-8000-000000000002',
        issueId: issue.id,
        expectedRowVersion: 0,
        position: 1,
        topic: issue.topic,
        findings: issue.findings,
        proposal: issue.proposal,
        actionPlan: issue.actionPlan,
        monitoring: issue.monitoring,
        stakeholderRoles: issue.stakeholderRoles,
      }),
    }))
  })

  it('reuses a caller-supplied mutation id when an offline write is retried', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(201, { data: { ...issue, rowVersion: 1 }, replayed: false, requestId: 'request-retry-1' }))
      .mockResolvedValueOnce(response(200, { data: { id: issue.id, groupId, deleted: true, rowVersion: 4, updatedAt: issue.updatedAt }, replayed: false, requestId: 'request-retry-2' }))
    const repository = new HttpFaRepository(fetcher, () => '50000000-0000-4000-8000-000000000099')

    await repository.upsertIssue({ ...issue, rowVersion: 0 }, '50000000-0000-4000-8000-000000000010')
    await repository.deleteIssue(issue, '50000000-0000-4000-8000-000000000011')

    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      mutationId: '50000000-0000-4000-8000-000000000010',
    })
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toMatchObject({
      mutationId: '50000000-0000-4000-8000-000000000011',
    })
  })

  it('maps a conflict response to a typed error without returning raw server content', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(409, {
      status: 'error', code: 'VERSION_CONFLICT', requestId: 'request-3', raw: 'private detail',
    }))
    const repository = new HttpFaRepository(fetcher)

    const error = await repository.upsertIssue(issue).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(FaRepositoryError)
    expect(error).toMatchObject({ code: 'VERSION_CONFLICT', retryable: false })
    expect(String(error)).not.toContain('private detail')
  })

  it('treats a network failure as retryable for the offline queue', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network secret details'))
    const repository = new HttpFaRepository(fetcher)

    const error = await repository.deleteIssue(issue).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(FaRepositoryError)
    expect(error).toMatchObject({ code: 'NETWORK_UNAVAILABLE', retryable: true })
    expect(String(error)).not.toContain('network secret details')
  })

  it('loads Supabase offset timestamps from the session-bound bootstrap', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, { data: workspace, requestId: 'request-4' }))

    await expect(new HttpFaRepository(fetcher).bootstrap()).resolves.toEqual(workspace)
    expect(fetcher).toHaveBeenCalledWith('/api/fa/bootstrap', {
      method: 'GET', credentials: 'include',
    })
  })

  it('saves presenter and review state with the current group version', async () => {
    const saved = { ...group, status: 'review_ready' as const, rowVersion: 4 }
    const fetcher = vi.fn().mockResolvedValue(response(200, { data: saved, replayed: false, requestId: 'request-5' }))
    const repository = new HttpFaRepository(fetcher, () => '50000000-0000-4000-8000-000000000005')

    await expect(repository.saveGroup({ ...group, status: 'review_ready' })).resolves.toEqual(saved)
    expect(fetcher).toHaveBeenCalledWith('/api/fa/group', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        mutationId: '50000000-0000-4000-8000-000000000005',
        expectedRowVersion: 3,
        presenter: 'ผู้นำเสนอ',
        status: 'review_ready',
      }),
    }))
  })

  it('Finals the bound group with its current row version', async () => {
    const saved = { ...group, status: 'final' as const, rowVersion: 4, finalizedAt: '2026-08-27T02:00:00.000Z' }
    const fetcher = vi.fn().mockResolvedValue(response(200, { data: saved, replayed: false, requestId: 'request-6' }))
    const repository = new HttpFaRepository(fetcher, () => '50000000-0000-4000-8000-000000000006')

    await expect(repository.finalize(group)).resolves.toEqual(saved)
    expect(fetcher).toHaveBeenCalledWith('/api/fa/finalize', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        mutationId: '50000000-0000-4000-8000-000000000006',
        expectedRowVersion: 3,
      }),
    }))
  })

  it('reuses caller-supplied mutation ids for queued group writes', async () => {
    const saved = { ...group, rowVersion: 4 }
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, { data: saved, replayed: false, requestId: 'request-retry-3' }))
      .mockResolvedValueOnce(response(200, { data: { ...saved, status: 'final', finalizedAt: '2026-08-27T02:00:00.000Z' }, replayed: false, requestId: 'request-retry-4' }))
    const repository = new HttpFaRepository(fetcher, () => '50000000-0000-4000-8000-000000000099')

    await repository.saveGroup(group, '50000000-0000-4000-8000-000000000012')
    await repository.finalize(group, '50000000-0000-4000-8000-000000000013')

    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({ mutationId: '50000000-0000-4000-8000-000000000012' })
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toMatchObject({ mutationId: '50000000-0000-4000-8000-000000000013' })
  })

  it('reorders every issue in one version-checked request', async () => {
    const reordered = [{ ...issue, sortOrder: 1 }]
    const fetcher = vi.fn().mockResolvedValue(response(200, { data: { issues: reordered }, replayed: false, requestId: 'request-reorder' }))
    const repository = new HttpFaRepository(fetcher, () => '50000000-0000-4000-8000-000000000020')

    await expect(repository.reorderIssues(reordered)).resolves.toEqual(reordered)
    expect(fetcher).toHaveBeenCalledWith('/api/fa/reorder', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        mutationId: '50000000-0000-4000-8000-000000000020',
        expectedRowVersion: 0,
        items: [{
          id: issue.id, expectedRowVersion: issue.rowVersion, position: 0,
          topic: issue.topic, findings: issue.findings, proposal: issue.proposal,
          actionPlan: issue.actionPlan, monitoring: issue.monitoring,
          stakeholderRoles: issue.stakeholderRoles,
        }],
      }),
    }))
  })
})
