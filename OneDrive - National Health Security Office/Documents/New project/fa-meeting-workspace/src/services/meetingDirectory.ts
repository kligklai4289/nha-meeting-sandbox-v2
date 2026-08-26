import type { MeetingWithGroups } from '../domain/meeting'

export interface MeetingDirectory {
  getActiveMeeting(signal?: AbortSignal): Promise<MeetingWithGroups | null>
}

export type MeetingDirectoryErrorCode =
  | 'MEETING_DIRECTORY_UNAVAILABLE'
  | 'INVALID_MEETING_DIRECTORY_RESPONSE'

export class MeetingDirectoryError extends Error {
  readonly code: MeetingDirectoryErrorCode
  readonly requestId?: string

  constructor(code: MeetingDirectoryErrorCode, requestId?: string) {
    super(code)
    this.name = 'MeetingDirectoryError'
    this.code = code
    this.requestId = requestId
  }
}
