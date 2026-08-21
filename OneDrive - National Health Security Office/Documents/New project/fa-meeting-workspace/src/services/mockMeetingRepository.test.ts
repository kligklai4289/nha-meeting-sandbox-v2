import { describe, expect, it } from 'vitest'
import { MockMeetingRepository } from './mockMeetingRepository'

describe('MockMeetingRepository', () => {
  it('returns the active meeting with exactly three fixed groups', async () => {
    const repository = new MockMeetingRepository()

    const meeting = await repository.getActiveMeeting()

    expect(meeting?.fiscalYear).toBe('2570')
    expect(meeting?.groups.map((group) => group.groupNo)).toEqual([1, 2, 3])
    expect(meeting?.groups[2].groupName).toBe(
      'งานคุ้มครองสิทธิ ม.57, ม.59, การป้องกันเกิดซ้ำ (RCA)',
    )
  })

  it('returns isolated copies so callers cannot mutate repository state', async () => {
    const repository = new MockMeetingRepository()
    const first = await repository.getActiveMeeting()
    if (!first) throw new Error('Expected an active meeting fixture')
    first.groups[0].presenter = 'เปลี่ยนจากภายนอก'

    const second = await repository.getActiveMeeting()

    expect(second?.groups[0].presenter).toBe('')
  })
})
