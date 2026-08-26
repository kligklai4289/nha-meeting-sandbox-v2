import { useEffect } from 'react'
import type { MeetingRepository } from '../services/meetingRepository'

export function useRealtimeMeeting(
  repository: MeetingRepository,
  meetingId: string | null | undefined,
  onChange: () => void,
) {
  useEffect(() => {
    if (!meetingId) return
    return repository.subscribe(meetingId, onChange)
  }, [meetingId, onChange, repository])
}
