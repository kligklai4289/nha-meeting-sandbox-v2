import { describe, expect, it, vi } from 'vitest'
import {
  createFaSessionToken,
  hashFaAccessCode,
  verifyFaSessionToken,
  type FaSessionClaims,
} from '../_lib/faSession.js'
import { createFaSessionHandler } from '../fa/session.js'

const claims: FaSessionClaims = {
  sessionId: '30000000-0000-4000-8000-000000000001',
  meetingId: '00000000-0000-4000-8000-000000000001',
  groupId: '10000000-0000-4000-8000-000000000001',
  expiresAt: '2026-08-27T10:00:00.000Z',
}

const signingSecret = 'session-signing-secret-for-tests-1234567890'
const workspace = {
  meeting: {
    id: claims.meetingId,
    title: 'การประชุม',
    fiscalYear: '2570',
    meetingDate: '2026-08-27',
    startTime: '09:00',
    endTime: '16:30',
    location: 'อยุธยา',
    status: 'active',
    isActive: true,
    createdAt: '2026-08-27T01:00:00.000Z',
    updatedAt: '2026-08-27T01:00:00.000Z',
  },
  group: { id: claims.groupId },
  issues: [],
}

function post(body: unknown): Request {
  return new Request('https://meeting.example/api/fa/session', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'fa-session-request',
      'x-forwarded-for': '203.0.113.10',
    },
    body: JSON.stringify(body),
  })
}

describe('FA session cryptography', () => {
  it('binds an access-code hash to the configured pepper', () => {
    const accessCode = '4826'
    const hashWithPepperA = hashFaAccessCode(accessCode, 'pepper-a'.repeat(8))

    expect(hashWithPepperA).toMatch(/^[a-f0-9]{64}$/)
    expect(hashFaAccessCode(accessCode, 'pepper-b'.repeat(8))).not.toBe(hashWithPepperA)
  })

  it('rejects a token whose payload or signature was changed', () => {
    const token = createFaSessionToken(claims, signingSecret)
    const [payload, signature] = token.split('.')

    expect(verifyFaSessionToken(`${payload}x.${signature}`, signingSecret, new Date('2026-08-27T09:00:00Z'))).toBeNull()
    expect(verifyFaSessionToken(`${payload}.${signature}x`, signingSecret, new Date('2026-08-27T09:00:00Z'))).toBeNull()
  })

  it('rejects an expired token and accepts the same token before expiry', () => {
    const token = createFaSessionToken(claims, signingSecret)

    expect(verifyFaSessionToken(token, signingSecret, new Date('2026-08-27T09:59:59Z'))).toEqual(claims)
    expect(verifyFaSessionToken(token, signingSecret, new Date('2026-08-27T10:00:00Z'))).toBeNull()
  })
})

describe('POST /api/fa/session', () => {
  it('issues only a secure HttpOnly cookie when the group code is valid', async () => {
    const gateway = {
      exchangeAccessCode: vi.fn().mockResolvedValue(claims),
    }
    const handler = createFaSessionHandler(gateway, signingSecret)

    const response = await handler.fetch(post({
      groupId: claims.groupId,
      accessCode: '1550',
    }))
    const body = await response.json()
    const cookie = response.headers.get('set-cookie') ?? ''

    expect(response.status).toBe(200)
    expect(cookie).toMatch(/^fa_session=[^.]+\.[^;]+;/)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Path=/')
    expect(body).toEqual({
      data: {
        meetingId: claims.meetingId,
        groupId: claims.groupId,
        expiresAt: claims.expiresAt,
      },
      requestId: 'fa-session-request',
    })
    expect(JSON.stringify(body)).not.toContain(claims.sessionId)
  })

  it('returns initial workspace data with the session without exposing the session id', async () => {
    const gateway = {
      exchangeAccessCode: vi.fn().mockResolvedValue(claims),
      getBootstrap: vi.fn().mockResolvedValue(workspace),
    }
    const handler = createFaSessionHandler(gateway, signingSecret)

    const response = await handler.fetch(post({
      groupId: claims.groupId,
      accessCode: '1550',
    }))
    const body = await response.json() as { data: { workspace?: unknown } }

    expect(response.status).toBe(200)
    expect(body.data.workspace).toEqual(workspace)
    expect(gateway.getBootstrap).toHaveBeenCalledWith(claims)
    expect(JSON.stringify(body)).not.toContain(claims.sessionId)
  })

  it('keeps the session usable when the workspace fast path is unavailable', async () => {
    const gateway = {
      exchangeAccessCode: vi.fn().mockResolvedValue(claims),
      getBootstrap: vi.fn().mockRejectedValue(new Error('temporary bootstrap failure')),
    }
    const handler = createFaSessionHandler(gateway, signingSecret)

    const response = await handler.fetch(post({
      groupId: claims.groupId,
      accessCode: '1550',
    }))
    const body = await response.json() as { data: Record<string, unknown> }

    expect(response.status).toBe(200)
    expect(body.data).toEqual({
      meetingId: claims.meetingId,
      groupId: claims.groupId,
      expiresAt: claims.expiresAt,
    })
  })

  it('returns one generic denial without leaking the submitted code', async () => {
    const secretCode = '9999'
    const gateway = { exchangeAccessCode: vi.fn().mockResolvedValue(null) }
    const handler = createFaSessionHandler(gateway, signingSecret)

    const response = await handler.fetch(post({ groupId: claims.groupId, accessCode: secretCode }))
    const text = await response.text()

    expect(response.status).toBe(401)
    expect(JSON.parse(text)).toEqual({
      status: 'error',
      code: 'FA_ACCESS_DENIED',
      requestId: 'fa-session-request',
    })
    expect(text).not.toContain(secretCode)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('rejects malformed input before calling the gateway', async () => {
    const gateway = { exchangeAccessCode: vi.fn() }
    const handler = createFaSessionHandler(gateway, signingSecret)

    const response = await handler.fetch(post({ groupId: 'not-a-uuid', accessCode: '' }))

    expect(response.status).toBe(400)
    expect(gateway.exchangeAccessCode).not.toHaveBeenCalled()
  })
})
