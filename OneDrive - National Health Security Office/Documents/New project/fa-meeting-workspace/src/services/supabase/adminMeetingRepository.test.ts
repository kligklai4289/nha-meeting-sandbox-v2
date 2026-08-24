import { describe, expect, it, vi } from 'vitest'
import { AdminMeetingRepository, type AdminMeetingGateway } from './adminMeetingRepository'

const meetingRow = {
  id: '00000000-0000-4000-8000-000000000001', title: 'รอบประชุม', fiscal_year: 2569,
  meeting_date: '2026-08-27', starts_at: '09:00:00', ends_at: '16:00:00', location: 'ห้องประชุม',
  status: 'active' as const, row_version: 1, created_at: '2026-08-20T01:00:00Z', updated_at: '2026-08-20T01:00:00Z',
}
const groupRow = {
  id: '10000000-0000-4000-8000-000000000001', meeting_id: meetingRow.id, group_no: 1,
  name: 'กลุ่มหนึ่ง', scope: 'ขอบเขต', presenter: '', status: 'draft' as const, row_version: 1,
  finalized_at: null, created_at: meetingRow.created_at, updated_at: meetingRow.updated_at,
}
const issueRow = {
  id: '20000000-0000-4000-8000-000000000001', meeting_id: meetingRow.id, group_id: groupRow.id,
  position: 0, topic: 'หัวข้อ', findings: '', proposal: '', action_plan: '', evaluation: '',
  stakeholder_roles: '', row_version: 1, deleted_at: null,
  created_at: meetingRow.created_at, updated_at: meetingRow.updated_at,
}

function gateway(overrides: Partial<AdminMeetingGateway> = {}): AdminMeetingGateway {
  return {
    getActiveMeeting: vi.fn().mockResolvedValue(meetingRow),
    getGroups: vi.fn().mockResolvedValue([groupRow]),
    getGroup: vi.fn().mockResolvedValue(groupRow),
    getIssues: vi.fn().mockResolvedValue([issueRow]),
    updateMeeting: vi.fn().mockResolvedValue({ ...meetingRow, title: 'แก้ไขแล้ว', row_version: 2 }),
    updateGroup: vi.fn().mockResolvedValue({ ...groupRow, status: 'draft', row_version: 2 }),
    saveGroupBundle: vi.fn().mockResolvedValue({ group: { ...groupRow, row_version: 2 }, issues: [issueRow] }),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    ...overrides,
  }
}

describe('AdminMeetingRepository', () => {
  it('maps the active meeting and ordered groups from Supabase rows', async () => {
    const repository = new AdminMeetingRepository(gateway())
    await expect(repository.getActiveMeeting()).resolves.toEqual(expect.objectContaining({
      id: meetingRow.id,
      fiscalYear: '2569',
      isActive: true,
      groups: [expect.objectContaining({ id: groupRow.id, groupNo: 1, groupName: 'กลุ่มหนึ่ง' })],
    }))
  })

  it('saves a group and its issues through one version-checked bundle call', async () => {
    const data = gateway()
    const repository = new AdminMeetingRepository(data)
    const group = await repository.getGroup(groupRow.id)
    const issues = await repository.getIssues(groupRow.id)
    if (!group) throw new Error('missing fixture group')

    await repository.saveGroupBundle({ ...group, presenter: 'ผู้นำเสนอ' }, issues)

    expect(data.saveGroupBundle).toHaveBeenCalledWith(
      expect.objectContaining({ id: group.id, rowVersion: 1, presenter: 'ผู้นำเสนอ' }),
      [expect.objectContaining({ id: issueRow.id, rowVersion: 1 })],
    )
  })

  it('delegates a scoped realtime subscription and cleanup', () => {
    const cleanup = vi.fn()
    const data = gateway({ subscribe: vi.fn().mockReturnValue(cleanup) })
    const repository = new AdminMeetingRepository(data)
    const onChange = vi.fn()

    expect(repository.subscribe(meetingRow.id, onChange)).toBe(cleanup)
    expect(data.subscribe).toHaveBeenCalledWith(meetingRow.id, onChange)
  })
})
