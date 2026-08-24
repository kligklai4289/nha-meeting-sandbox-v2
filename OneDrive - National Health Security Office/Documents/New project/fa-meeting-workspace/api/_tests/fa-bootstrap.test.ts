import { describe, expect, it, vi } from 'vitest'
import type { FaSessionClaims } from '../_lib/faSession.js'
import { createFaBootstrapHandler } from '../fa/bootstrap.js'

const claims: FaSessionClaims = {
  sessionId: '30000000-0000-4000-8000-000000000001',
  meetingId: '00000000-0000-4000-8000-000000000001',
  groupId: '10000000-0000-4000-8000-000000000001',
  expiresAt: '2026-08-27T10:00:00.000Z',
}

const signingSecret = 'session-signing-secret-for-tests-1234567890'

function get(cookie?: string): Request {
  const headers: Record<string, string> = { 'x-request-id': 'fa-bootstrap-request' }
  if (cookie) headers.cookie = `fa_session=${cookie}`
  return new Request('https://meeting.example/api/fa/bootstrap', { headers })
}

describe('GET /api/fa/bootstrap', () => {
  it('rejects a request without a session before querying data', async () => {
    const gateway = { getBootstrap: vi.fn() }
    const handler = createFaBootstrapHandler(gateway, signingSecret)

    const response = await handler.fetch(get())

    expect(response.status).toBe(401)
    expect(gateway.getBootstrap).not.toHaveBeenCalled()
  })

  it('returns only data from the group bound to the verified session', async () => {
    const { createFaSessionToken } = await import('../_lib/faSession.js')
    const token = createFaSessionToken(claims, signingSecret)
    const data = {
      meeting: { id: claims.meetingId, title: 'การประชุม', meetingDate: '2026-08-27' },
      group: { id: claims.groupId, groupNo: 1, name: 'บริหารกองทุน เหมาจ่าย', rowVersion: 3 },
      issues: [{ id: '40000000-0000-4000-8000-000000000001', groupId: claims.groupId, rowVersion: 2 }],
    }
    const gateway = { getBootstrap: vi.fn().mockResolvedValue(data) }
    const handler = createFaBootstrapHandler(gateway, signingSecret, () => new Date('2026-08-27T09:00:00Z'))

    const response = await handler.fetch(get(token))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data, requestId: 'fa-bootstrap-request' })
    expect(gateway.getBootstrap).toHaveBeenCalledWith(claims)
  })

  it('denies a revoked, missing, closed-meeting, or cross-group session generically', async () => {
    const { createFaSessionToken } = await import('../_lib/faSession.js')
    const token = createFaSessionToken(claims, signingSecret)
    const gateway = { getBootstrap: vi.fn().mockResolvedValue(null) }
    const handler = createFaBootstrapHandler(gateway, signingSecret, () => new Date('2026-08-27T09:00:00Z'))

    const response = await handler.fetch(get(token))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      status: 'error',
      code: 'FA_SESSION_INVALID',
      requestId: 'fa-bootstrap-request',
    })
  })
})
