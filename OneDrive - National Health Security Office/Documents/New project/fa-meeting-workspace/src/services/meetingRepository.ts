import type { MeetingGroup } from '../domain/group'
import type { Issue } from '../domain/issue'
import type { Meeting, MeetingStatus, MeetingWithGroups, NewMeeting } from '../domain/meeting'

export interface MeetingRepository {
  getActiveMeeting(): Promise<MeetingWithGroups | null>
  listMeetings(): Promise<MeetingWithGroups[]>
  getMeeting(meetingId: string): Promise<MeetingWithGroups | null>
  createMeeting(meeting: NewMeeting): Promise<MeetingWithGroups>
  setMeetingStatus(meetingId: string, status: Extract<MeetingStatus, 'active' | 'closed'>): Promise<Meeting>
  deleteDraftMeeting(meetingId: string): Promise<void>
  getGroup(groupId: string): Promise<MeetingGroup | null>
  getIssues(groupId: string): Promise<Issue[]>
  saveMeeting(meeting: Meeting): Promise<Meeting>
  saveGroup(group: MeetingGroup): Promise<MeetingGroup>
  saveIssues(groupId: string, issues: Issue[]): Promise<Issue[]>
  saveGroupBundle(group: MeetingGroup, issues: Issue[]): Promise<{ group: MeetingGroup; issues: Issue[] }>
  subscribe(meetingId: string, onChange: () => void): () => void
  reset(): Promise<void>
}
