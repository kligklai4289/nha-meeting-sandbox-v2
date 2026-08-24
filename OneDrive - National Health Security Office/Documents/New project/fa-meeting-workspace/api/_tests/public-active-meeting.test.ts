import { describe, expect, it, vi } from 'vitest'
import type { MeetingWithGroups } from '../../src/domain/meeting.js'
import { createActiveMeetingHandler } from '../public/active-meeting.js'

const meeting: MeetingWithGroups = {
  id: '10000000-0000-4000-8000-000000000001',
  title: 'ประชุมติดตามผลการดำเนินงาน',
  fiscalYear: '2569',
  meetingDate: '2026-08-27',
  startTime: '09:00',
  endTime: '16:30',
  location: 'ห้องประชุม 1',
  status: 'active',
  isActive: true,
  createdAt: '2026-08-20T08:00:00+00:00',
  updatedAt: '2026-08-21T09:30:00+00:00',
  groups: [
    {
      id: '20000000-0000-4000-8000-000000000001',
      meetingId: '10000000-0000-4000-8000-000000000001',
      groupNo: 1,
      groupName: 'กลุ่มที่ 1',
      groupDescription: 'ขอบเขตกลุ่มที่ 1',
      presenter: 'ผู้นำเสนอกลุ่มที่ 1',
      status: 'draft',
      rowVersion: 1,
      finalizedAt: null,
      createdAt: '2026-08-20T08:10:00+00:00',
      updatedAt: '2026-08-21T09:40:00+00:00',
    },
  ],
}

function request(method = 'GET'): Request {
  return new Request('https://example.test/api/public/active-meeting', {
    method,
    headers: { 'x-request-id': 'test-request-id' },
  })
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function expectGeneratedRequestId(request: Request): Promise<void> {
  const gateway = { getActiveMeeting: vi.fn().mockResolvedValue(null) }
  const handler = createActiveMeetingHandler(gateway)

  const response = await handler.fetch(request)
  const responseRequestId = response.headers.get('x-request-id')
  const body = await response.json()

  expect(response.status).toBe(200)
  expect(responseRequestId).toMatch(uuidPattern)
  expect(body).toEqual({ data: null, requestId: responseRequestId })
}

describe('GET /api/public/active-meeting', () => {
  it('returns the active meeting as a no-store response with the request ID', async () => {
    const gateway = { getActiveMeeting: vi.fn().mockResolvedValue(meeting) }
    const handler = createActiveMeetingHandler(gateway)

    const response = await handler.fetch(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('x-request-id')).toBe('test-request-id')
    expect(await response.json()).toEqual({ data: meeting, requestId: 'test-request-id' })
  })

  it('returns null data when no active meeting exists', async () => {
    const gateway = { getActiveMeeting: vi.fn().mockResolvedValue(null) }
    const handler = createActiveMeetingHandler(gateway)

    const response = await handler.fetch(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-request-id')).toBe('test-request-id')
    expect(await response.json()).toEqual({ data: null, requestId: 'test-request-id' })
  })

  it('rejects non-GET methods before accessing the meeting directory', async () => {
    const secret = 'sb_secret_test_post-must-not-run'
    const gateway = { getActiveMeeting: vi.fn().mockRejectedValue(new Error(secret)) }
    const handler = createActiveMeetingHandler(gateway)

    const response = await handler.fetch(request('POST'))

    expect(response.status).toBe(405)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('allow')).toBe('GET')
    expect(response.headers.get('x-request-id')).toBe('test-request-id')
    expect(await response.json()).toEqual({
      status: 'error',
      code: 'METHOD_NOT_ALLOWED',
      requestId: 'test-request-id',
    })
    expect(gateway.getActiveMeeting).not.toHaveBeenCalled()
  })

  it('generates and correlates a UUID request ID when the header is missing', async () => {
    await expectGeneratedRequestId(
      new Request('https://example.test/api/public/active-meeting'),
    )
  })

  it('generates and correlates a UUID request ID when the header is whitespace-only', async () => {
    await expectGeneratedRequestId(
      new Request('https://example.test/api/public/active-meeting', {
        headers: { 'x-request-id': '   ' },
      }),
    )
  })

  it('returns a safe unavailable response when the meeting directory rejects', async () => {
    const secrets = [
      'sb_secret_test_do-not-expose',
      'FA_CODE_PEPPER=do-not-expose',
    ]
    const gateway = {
      getActiveMeeting: vi.fn().mockRejectedValue(
        new Error(`upstream failed: ${secrets.join(' ')}`),
      ),
    }
    const handler = createActiveMeetingHandler(gateway)

    const response = await handler.fetch(request())
    const headers = Array.from(response.headers.entries()).join('\n')
    const body = await response.text()

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('x-request-id')).toBe('test-request-id')
    expect(JSON.parse(body)).toEqual({
      status: 'error',
      code: 'MEETING_DIRECTORY_UNAVAILABLE',
      requestId: 'test-request-id',
    })
    for (const secret of secrets) {
      expect(String(response.status)).not.toContain(secret)
      expect(headers).not.toContain(secret)
      expect(body).not.toContain(secret)
    }
  })
})
