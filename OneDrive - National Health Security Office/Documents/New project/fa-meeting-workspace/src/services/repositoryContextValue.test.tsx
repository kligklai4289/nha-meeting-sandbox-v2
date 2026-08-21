import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSeed } from './mockSeed'

describe('default browser meeting repository', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('hydrates the application repository from browser storage', async () => {
    const seed = createMockSeed()
    seed.issues[0].topic = 'ข้อมูลที่บันทึกไว้ก่อนโหลดแอป'
    localStorage.setItem('fa-meeting-workspace:mock-data:v1', JSON.stringify(seed))
    const { useMeetingRepository } = await import('./useMeetingRepository')

    const { result } = renderHook(() => useMeetingRepository())

    expect((await result.current.getIssues(seed.groups[0].id))[0].topic)
      .toBe('ข้อมูลที่บันทึกไว้ก่อนโหลดแอป')
  })
})
