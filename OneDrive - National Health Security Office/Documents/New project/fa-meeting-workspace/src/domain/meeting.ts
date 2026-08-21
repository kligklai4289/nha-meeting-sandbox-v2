import type { MeetingGroup } from './group'

export interface Meeting {
  id: string
  title: string
  fiscalYear: string
  meetingDate: string
  startTime: string
  endTime: string
  location: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface MeetingWithGroups extends Meeting {
  groups: MeetingGroup[]
}
