import type { MeetingGroup } from './group'

export type MeetingStatus = 'draft' | 'active' | 'closed'

export interface Meeting {
  id: string
  title: string
  fiscalYear: string
  meetingDate: string
  startTime: string
  endTime: string
  location: string
  status: MeetingStatus
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface MeetingWithGroups extends Meeting {
  groups: MeetingGroup[]
}

export type NewMeeting = Pick<
  Meeting,
  'title' | 'fiscalYear' | 'meetingDate' | 'startTime' | 'endTime' | 'location'
>
