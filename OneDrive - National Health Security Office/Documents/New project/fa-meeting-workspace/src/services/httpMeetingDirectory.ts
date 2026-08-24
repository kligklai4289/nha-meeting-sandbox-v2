import type { MeetingWithGroups } from '../domain/meeting'
import { MeetingDirectoryError, type MeetingDirectory } from './meetingDirectory'
import { publicMeetingResponseSchema } from './publicMeetingContract'

const defaultEndpoint = '/api/public/active-meeting'

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

function requestIdFromPayload(payload: unknown): string | undefined {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'requestId' in payload &&
    typeof payload.requestId === 'string' &&
    payload.requestId.length > 0
  ) {
    return payload.requestId
  }

  return undefined
}

export class HttpMeetingDirectory implements MeetingDirectory {
  private readonly endpoint: string
  private readonly fetchImpl: typeof fetch

  constructor(
    endpoint = defaultEndpoint,
    fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.endpoint = endpoint
    this.fetchImpl = fetchImpl
  }

  async getActiveMeeting(signal?: AbortSignal): Promise<MeetingWithGroups | null> {
    let response: Response

    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal,
      })
    } catch (error) {
      if (isAbortError(error)) throw error
      throw new MeetingDirectoryError('MEETING_DIRECTORY_UNAVAILABLE')
    }

    if (!response.ok) {
      let requestId: string | undefined

      try {
        requestId = requestIdFromPayload(await response.json())
      } catch (error) {
        if (isAbortError(error)) throw error
      }

      throw new MeetingDirectoryError('MEETING_DIRECTORY_UNAVAILABLE', requestId)
    }

    let payload: unknown

    try {
      payload = await response.json()
    } catch (error) {
      if (isAbortError(error)) throw error
      throw new MeetingDirectoryError('INVALID_MEETING_DIRECTORY_RESPONSE')
    }

    const parsed = publicMeetingResponseSchema.safeParse(payload)
    if (!parsed.success) {
      throw new MeetingDirectoryError(
        'INVALID_MEETING_DIRECTORY_RESPONSE',
        requestIdFromPayload(payload),
      )
    }

    return parsed.data.data
  }
}
