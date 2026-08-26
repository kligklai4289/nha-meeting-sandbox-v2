import { describe, expect, it, vi } from 'vitest'
import { createAdminAccessCodeHandler } from '../admin/access-codes.js'

const groupId = '10000000-0000-4000-8000-000000000001'

function post(token = 'valid-admin-token', accessCode = '1234') {
  return new Request('https://meeting.example/api/admin/access-codes', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-request-id': 'rotate-code-request',
    },
    body: JSON.stringify({ groupId, accessCode }),
  })
}

describe('POST /api/admin/access-codes', () => {
  it('denies an inactive Admin before generating or rotating a code', async () => {
    const gateway = {
      authorize: vi.fn().mockResolvedValue(null),
      rotate: vi.fn(),
    }
    const handler = createAdminAccessCodeHandler(gateway, 'pepper-value-that-is-at-least-32-bytes')

    const response = await handler.fetch(post('inactive-admin-token'))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      status: 'error', code: 'ADMIN_FORBIDDEN', requestId: 'rotate-code-request',
    })
    expect(gateway.rotate).not.toHaveBeenCalled()
  })

  it('stores only the hash of the four-digit code selected by Admin', async () => {
    const gateway = {
      authorize: vi.fn().mockResolvedValue({ userId: '90000000-0000-4000-8000-000000000001' }),
      rotate: vi.fn().mockResolvedValue({ rotatedAt: '2026-08-23T04:00:00.000Z', revokedSessions: 2 }),
    }
    const handler = createAdminAccessCodeHandler(gateway, 'pepper-value-that-is-at-least-32-bytes')

    const response = await handler.fetch(post())
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toEqual({
      data: { groupId, rotatedAt: '2026-08-23T04:00:00.000Z', revokedSessions: 2 },
      requestId: 'rotate-code-request',
    })
    expect(gateway.rotate).toHaveBeenCalledWith({
      actorId: '90000000-0000-4000-8000-000000000001',
      groupId,
      codeHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
    expect(JSON.stringify(gateway.rotate.mock.calls)).not.toContain('1234')
  })

  it('rejects codes that are not exactly four digits', async () => {
    const gateway = {
      authorize: vi.fn().mockResolvedValue({ userId: '90000000-0000-4000-8000-000000000001' }),
      rotate: vi.fn(),
    }
    const handler = createAdminAccessCodeHandler(gateway, 'pepper-value-that-is-at-least-32-bytes')

    const response = await handler.fetch(post('valid-admin-token', '12345'))

    expect(response.status).toBe(400)
    expect(gateway.rotate).not.toHaveBeenCalled()
  })

  it('returns a safe error when Admin authorization is unavailable', async () => {
    const gateway = {
      authorize: vi.fn().mockRejectedValue(new Error('sensitive upstream detail')),
      rotate: vi.fn(),
    }
    const handler = createAdminAccessCodeHandler(gateway, 'pepper-value-that-is-at-least-32-bytes')

    const response = await handler.fetch(post())

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      status: 'error', code: 'ADMIN_AUTH_UNAVAILABLE', requestId: 'rotate-code-request',
    })
    expect(gateway.rotate).not.toHaveBeenCalled()
  })
})
