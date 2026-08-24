import type { GroupStatus } from './status'

export interface MeetingGroup {
  id: string
  meetingId: string
  groupNo: 1 | 2 | 3
  groupName: string
  groupDescription: string
  presenter: string
  status: GroupStatus
  rowVersion: number
  finalizedAt: string | null
  createdAt: string
  updatedAt: string
}
