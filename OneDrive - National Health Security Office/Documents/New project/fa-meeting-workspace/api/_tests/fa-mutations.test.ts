import { describe, expect, it, vi } from 'vitest'
import { createFaSessionToken, type FaSessionClaims } from '../_lib/faSession.js'
import type { FaMutationGateway, FaMutationResult } from '../_lib/faMutations.js'
import { createFaFinalizeHandler } from '../fa/finalize.js'
import { createFaGroupHandler } from '../fa/group.js'
import { createFaIssuesHandler } from '../fa/issues.js'
import { createFaReorderIssuesHandler } from '../fa/reorder.js'
import { createFaDeleteIssueHandler } from '../fa/issues/[id].js'

const secret = 'session-signing-secret-for-tests-1234567890'
const meetingId = '00000000-0000-4000-8000-000000000001'
const groups = [1, 2, 3].map((groupNo) => ({
  sessionId: `30000000-0000-4000-8000-00000000000${groupNo}`,
  meetingId,
  groupId: `10000000-0000-4000-8000-00000000000${groupNo}`,
  expiresAt: '2026-08-27T10:00:00.000Z',
})) satisfies FaSessionClaims[]

function request(
  path: string,
  method: string,
  claims: FaSessionClaims,
  body: unknown,
): Request {
  return new Request(`https://meeting.example${path}`, {
    method,
    headers: {
      cookie: `fa_session=${createFaSessionToken(claims, secret)}`,
      'content-type': 'application/json',
      origin: 'https://meeting.example',
      'x-request-id': 'mutation-request',
    },
    body: JSON.stringify(body),
  })
}

const issueBody = {
  mutationId: '50000000-0000-4000-8000-000000000001',
  issueId: '40000000-0000-4000-8000-000000000001',
  expectedRowVersion: 2,
  position: 0,
  topic: 'ประเด็น',
  findings: 'ข้อค้นพบ',
  proposal: 'ข้อเสนอ',
  actionPlan: 'แผนงาน',
  monitoring: 'ติดตาม',
  stakeholderRoles: 'บทบาท',
}

describe('FA mutation handlers', () => {
  it('rejects a cross-origin mutation before accessing the gateway', async () => {
    const gateway: FaMutationGateway = { apply: vi.fn() }
    const handler = createFaIssuesHandler(gateway, secret, () => new Date('2026-08-27T09:00:00Z'))
    const unsafe = request('/api/fa/issues', 'PATCH', groups[0], issueBody)
    unsafe.headers.set('origin', 'https://attacker.example')

    const response = await handler.fetch(unsafe)

    expect(response.status).toBe(403)
    expect(gateway.apply).not.toHaveBeenCalled()
  })

  it('rejects a declared payload larger than 64 KiB before parsing it', async () => {
    const gateway: FaMutationGateway = { apply: vi.fn() }
    const handler = createFaIssuesHandler(gateway, secret, () => new Date('2026-08-27T09:00:00Z'))
    const oversized = request('/api/fa/issues', 'PATCH', groups[0], issueBody)
    oversized.headers.set('content-length', '65537')

    const response = await handler.fetch(oversized)

    expect(response.status).toBe(413)
    expect(gateway.apply).not.toHaveBeenCalled()
  })

  it('rejects a caller-supplied group id so a session cannot target another group', async () => {
    const gateway: FaMutationGateway = { apply: vi.fn() }
    const handler = createFaIssuesHandler(gateway, secret, () => new Date('2026-08-27T09:00:00Z'))

    const response = await handler.fetch(request('/api/fa/issues', 'PATCH', groups[0], {
      ...issueBody,
      groupId: groups[1].groupId,
    }))

    expect(response.status).toBe(400)
    expect(gateway.apply).not.toHaveBeenCalled()
  })

  it('maps an optimistic version conflict to HTTP 409 without leaking database details', async () => {
    const result: FaMutationResult = { ok: false, code: 'VERSION_CONFLICT' }
    const gateway: FaMutationGateway = { apply: vi.fn().mockResolvedValue(result) }
    const handler = createFaIssuesHandler(gateway, secret, () => new Date('2026-08-27T09:00:00Z'))

    const response = await handler.fetch(request('/api/fa/issues', 'PATCH', groups[0], issueBody))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      status: 'error', code: 'VERSION_CONFLICT', requestId: 'mutation-request',
    })
  })

  it('returns an idempotent receipt result as a normal successful save', async () => {
    const data = { id: issueBody.issueId, groupId: groups[0].groupId, rowVersion: 3 }
    const gateway: FaMutationGateway = { apply: vi.fn().mockResolvedValue({ ok: true, data, replayed: true }) }
    const handler = createFaIssuesHandler(gateway, secret, () => new Date('2026-08-27T09:00:00Z'))

    const response = await handler.fetch(request('/api/fa/issues', 'PATCH', groups[0], issueBody))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data, replayed: true, requestId: 'mutation-request' })
  })

  it('returns HTTP 201 for a newly created issue', async () => {
    const gateway: FaMutationGateway = { apply: vi.fn().mockResolvedValue({
      ok: true, data: { id: issueBody.issueId, rowVersion: 1 }, replayed: false,
    }) }
    const handler = createFaIssuesHandler(gateway, secret, () => new Date('2026-08-27T09:00:00Z'))

    const response = await handler.fetch(request('/api/fa/issues', 'POST', groups[0], {
      ...issueBody, expectedRowVersion: 0,
    }))

    expect(response.status).toBe(201)
  })

  it('keeps simultaneous writes scoped to each signed group session', async () => {
    const gateway: FaMutationGateway = {
      apply: vi.fn(async (mutation) => ({
        ok: true as const,
        data: { groupId: mutation.claims.groupId, topic: mutation.payload.topic },
        replayed: false,
      })),
    }
    const handler = createFaIssuesHandler(gateway, secret, () => new Date('2026-08-27T09:00:00Z'))

    const responses = await Promise.all(groups.map((claims, index) => handler.fetch(request(
      '/api/fa/issues',
      'PATCH',
      claims,
      {
        ...issueBody,
        mutationId: `50000000-0000-4000-8000-00000000000${index + 1}`,
        issueId: `40000000-0000-4000-8000-00000000000${index + 1}`,
        topic: `กลุ่ม ${index + 1}`,
      },
    ))))
    const bodies = await Promise.all(responses.map(async (response) =>
      await response.json() as { data: { groupId: string; topic: string } },
    ))

    expect(bodies.map((body) => body.data)).toEqual(groups.map((claims, index) => ({
      groupId: claims.groupId,
      topic: `กลุ่ม ${index + 1}`,
    })))
  })

  it('locks FA changes after Final and exposes one generic code', async () => {
    const gateway: FaMutationGateway = { apply: vi.fn().mockResolvedValue({ ok: false, code: 'GROUP_FINALIZED' }) }
    const handler = createFaGroupHandler(gateway, secret, () => new Date('2026-08-27T09:00:00Z'))
    const response = await handler.fetch(request('/api/fa/group', 'PATCH', groups[0], {
      mutationId: '50000000-0000-4000-8000-000000000010',
      expectedRowVersion: 3,
      presenter: 'ผู้นำเสนอ',
      status: 'review_ready',
    }))

    expect(response.status).toBe(423)
    expect(await response.json()).toEqual({
      status: 'error', code: 'GROUP_FINALIZED', requestId: 'mutation-request',
    })
  })

  it('sends Final as a dedicated mutation bound to the signed group', async () => {
    const gateway: FaMutationGateway = { apply: vi.fn().mockResolvedValue({ ok: true, data: { status: 'final' }, replayed: false }) }
    const handler = createFaFinalizeHandler(gateway, secret, () => new Date('2026-08-27T09:00:00Z'))

    const response = await handler.fetch(request('/api/fa/finalize', 'POST', groups[2], {
      mutationId: '50000000-0000-4000-8000-000000000011',
      expectedRowVersion: 4,
    }))

    expect(response.status).toBe(200)
    expect(gateway.apply).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'group_finalize',
      claims: groups[2],
      expectedRowVersion: 4,
    }))
  })

  it('takes the deleted issue id from the URL and never from caller-supplied group data', async () => {
    const gateway: FaMutationGateway = { apply: vi.fn().mockResolvedValue({ ok: true, data: { deleted: true }, replayed: false }) }
    const handler = createFaDeleteIssueHandler(gateway, secret, () => new Date('2026-08-27T09:00:00Z'))
    const issueId = '40000000-0000-4000-8000-000000000099'

    const response = await handler.fetch(request(`/api/fa/issues/${issueId}`, 'DELETE', groups[0], {
      mutationId: '50000000-0000-4000-8000-000000000099',
      expectedRowVersion: 5,
    }))

    expect(response.status).toBe(200)
    expect(gateway.apply).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'issue_delete', targetId: issueId, claims: groups[0],
    }))
  })

  it('sends an ordered version-checked issue list as one atomic mutation', async () => {
    const gateway: FaMutationGateway = { apply: vi.fn().mockResolvedValue({ ok: true, data: { issues: [] }, replayed: false }) }
    const handler = createFaReorderIssuesHandler(gateway, secret, () => new Date('2026-08-27T09:00:00Z'))
    const items = [
      { id: '40000000-0000-4000-8000-000000000001', expectedRowVersion: 2, position: 1, topic: 'ก', findings: '', proposal: '', actionPlan: '', monitoring: '', stakeholderRoles: '' },
      { id: '40000000-0000-4000-8000-000000000002', expectedRowVersion: 3, position: 0, topic: 'ข', findings: '', proposal: '', actionPlan: '', monitoring: '', stakeholderRoles: '' },
    ]

    const response = await handler.fetch(request('/api/fa/reorder', 'POST', groups[0], {
      mutationId: '50000000-0000-4000-8000-000000000020',
      expectedRowVersion: 0,
      items,
    }))

    expect(response.status).toBe(200)
    expect(gateway.apply).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'issues_reorder', targetId: null, payload: { items }, claims: groups[0],
    }))
  })
})
