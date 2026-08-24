import { describe, expect, it, vi } from 'vitest'
import { validPublicMeetingResponse } from '../test/publicMeetingFixture'
import { MeetingDirectoryError } from './meetingDirectory'
import { HttpMeetingDirectory } from './httpMeetingDirectory'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function expectSafeDirectoryError(
  error: unknown,
  code: 'MEETING_DIRECTORY_UNAVAILABLE' | 'INVALID_MEETING_DIRECTORY_RESPONSE',
): void {
  expect(error).toBeInstanceOf(MeetingDirectoryError)
  expect(error).toMatchObject({ code })
  expect(error).not.toHaveProperty('body')
  expect(JSON.stringify(error)).not.toContain('raw service diagnostic')
}

function getRejectedError(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Expected the meeting directory request to reject')
    },
    (error: unknown) => error,
  )
}

describe('HttpMeetingDirectory', () => {
  it('returns the validated active meeting from the public endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(validPublicMeetingResponse),
    )
    const directory = new HttpMeetingDirectory('/api/public/active-meeting', fetchImpl)

    await expect(directory.getActiveMeeting()).resolves.toEqual(validPublicMeetingResponse.data)
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/public/active-meeting',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
      }),
    )
  })

  it('uses the default active-meeting endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ data: null, requestId: 'default-endpoint-request-id' }),
    )
    const directory = new HttpMeetingDirectory(undefined, fetchImpl)

    await expect(directory.getActiveMeeting()).resolves.toBeNull()
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/public/active-meeting',
      expect.any(Object),
    )
  })

  it('invokes the default fetch with its required global receiver', async () => {
    const receiverSensitiveFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) {
        return Promise.reject(new TypeError('Illegal invocation'))
      }
      return Promise.resolve(
        jsonResponse({ data: null, requestId: 'receiver-safe-request-id' }),
      )
    }) as typeof fetch
    vi.stubGlobal('fetch', receiverSensitiveFetch)

    try {
      const directory = new HttpMeetingDirectory()

      await expect(directory.getActiveMeeting()).resolves.toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('returns null when the endpoint reports no active meeting', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ data: null, requestId: 'no-active-meeting-request-id' }),
    )
    const directory = new HttpMeetingDirectory('/api/public/active-meeting', fetchImpl)

    await expect(directory.getActiveMeeting()).resolves.toBeNull()
  })

  it('maps an unavailable endpoint to a safe error without retaining its response body', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          code: 'SERVICE_UNAVAILABLE',
          requestId: 'unavailable-request-id',
          detail: 'raw service diagnostic',
        },
        503,
      ),
    )
    const directory = new HttpMeetingDirectory('/api/public/active-meeting', fetchImpl)

    const error = await getRejectedError(directory.getActiveMeeting())

    expectSafeDirectoryError(error, 'MEETING_DIRECTORY_UNAVAILABLE')
    expect(error).toMatchObject({ requestId: 'unavailable-request-id' })
  })

  it('maps invalid JSON to a safe invalid-response error without retaining its response body', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('raw service diagnostic', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const directory = new HttpMeetingDirectory('/api/public/active-meeting', fetchImpl)

    const error = await getRejectedError(directory.getActiveMeeting())

    expectSafeDirectoryError(error, 'INVALID_MEETING_DIRECTORY_RESPONSE')
  })

  it('maps a response outside the public schema to a safe invalid-response error', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        ...validPublicMeetingResponse,
        data: { ...validPublicMeetingResponse.data, title: '' },
      }),
    )
    const directory = new HttpMeetingDirectory('/api/public/active-meeting', fetchImpl)

    const error = await getRejectedError(directory.getActiveMeeting())

    expectSafeDirectoryError(error, 'INVALID_MEETING_DIRECTORY_RESPONSE')
  })

  it('forwards an AbortSignal to fetch', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ data: null, requestId: 'abort-request-id' }),
    )
    const directory = new HttpMeetingDirectory('/api/public/active-meeting', fetchImpl)
    const controller = new AbortController()

    await directory.getActiveMeeting(controller.signal)

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/public/active-meeting',
      expect.objectContaining({ signal: controller.signal }),
    )
  })

  it('preserves a native AbortError without wrapping it', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(abortError)
    const directory = new HttpMeetingDirectory('/api/public/active-meeting', fetchImpl)

    await expect(directory.getActiveMeeting()).rejects.toBe(abortError)
  })
})
