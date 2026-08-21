import { beforeEach, describe, expect, it } from 'vitest'
import { MockMeetingRepository } from './mockMeetingRepository'

describe('MockMeetingRepository', () => {
  beforeEach(() => localStorage.clear())

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

  it('saves meeting edits for subsequent reads', async () => {
    const repository = new MockMeetingRepository()
    const meeting = await repository.getActiveMeeting()
    if (!meeting) throw new Error('Expected an active meeting fixture')

    await repository.saveMeeting({ ...meeting, title: 'รอบประชุมที่แก้ไข' })

    expect((await repository.getActiveMeeting())?.title).toBe('รอบประชุมที่แก้ไข')
  })

  it('restores saved group issues in a new browser repository instance', async () => {
    const repository = MockMeetingRepository.fromStorage(localStorage)
    const issues = await repository.getIssues('10000000-0000-4000-8000-000000000001')

    await repository.saveIssues('10000000-0000-4000-8000-000000000001', [
      { ...issues[0], topic: 'ข้อมูลที่กรอกจากกลุ่ม 1' },
      ...issues.slice(1),
    ])

    const reloadedRepository = MockMeetingRepository.fromStorage(localStorage)
    expect((await reloadedRepository.getIssues('10000000-0000-4000-8000-000000000001'))[0].topic)
      .toBe('ข้อมูลที่กรอกจากกลุ่ม 1')
  })

  it('falls back to the seed when stored browser data is invalid', async () => {
    localStorage.setItem('fa-meeting-workspace:mock-data:v1', '{invalid-json')

    const repository = MockMeetingRepository.fromStorage(localStorage)

    expect((await repository.getActiveMeeting())?.groups).toHaveLength(3)
  })

  it('resets browser data to the original meeting seed', async () => {
    const repository = MockMeetingRepository.fromStorage(localStorage)
    const meeting = await repository.getActiveMeeting()
    if (!meeting) throw new Error('Expected an active meeting fixture')
    await repository.saveMeeting({ ...meeting, title: 'ข้อมูลที่ต้องล้าง' })

    await repository.reset()

    const reloadedRepository = MockMeetingRepository.fromStorage(localStorage)
    expect((await reloadedRepository.getActiveMeeting())?.title).toBe(
      'แผนการดำเนินงาน ทิศทางการทำงานร่วมกันของอนุกรรมการ ปีงบประมาณ 2570',
    )
  })
})
