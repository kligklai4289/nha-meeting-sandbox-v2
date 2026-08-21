import type { MeetingGroup } from '../domain/group'
import type { Issue } from '../domain/issue'
import type { MeetingWithGroups } from '../domain/meeting'
import type { Meeting } from '../domain/meeting'

export interface MeetingRepository {
  getActiveMeeting(): Promise<MeetingWithGroups | null>
  getGroup(groupId: string): Promise<MeetingGroup | null>
  getIssues(groupId: string): Promise<Issue[]>
  saveMeeting(meeting: Meeting): Promise<Meeting>
  saveGroup(group: MeetingGroup): Promise<MeetingGroup>
  saveIssues(groupId: string, issues: Issue[]): Promise<Issue[]>
}
