import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MeetingRepository } from '../services/meetingRepository'
import { useRealtimeMeeting } from './useRealtimeMeeting'

describe('useRealtimeMeeting', () => {
  it('subscribes to the selected meeting and cleans up on unmount', () => {
    const cleanup = vi.fn()
    const subscribe = vi.fn().mockReturnValue(cleanup)
    const repository = { subscribe } as unknown as MeetingRepository
    const onChange = vi.fn()
    const { unmount } = renderHook(() => useRealtimeMeeting(repository, 'meeting-1', onChange))

    expect(subscribe).toHaveBeenCalledWith('meeting-1', onChange)
    unmount()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
