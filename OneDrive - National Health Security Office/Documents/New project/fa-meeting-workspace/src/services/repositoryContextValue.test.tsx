import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useMeetingRepository } from './useMeetingRepository'

describe('meeting repository boundary', () => {
  it('requires an explicit repository provider instead of creating production mock data', () => {
    expect(() => renderHook(() => useMeetingRepository())).toThrow('MeetingRepositoryProvider is required')
  })
})
