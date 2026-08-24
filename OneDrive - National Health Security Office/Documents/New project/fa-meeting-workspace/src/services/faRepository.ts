import type { MeetingGroup } from '../domain/group'
import type { Issue } from '../domain/issue'
import type { Meeting } from '../domain/meeting'

export interface FaBootstrap {
  meeting: Meeting
  group: MeetingGroup
  issues: Issue[]
}

export interface FaRepository {
  createSession(groupId: string, accessCode: string): Promise<{
    meetingId: string
    groupId: string
    expiresAt: string
  }>
  bootstrap(): Promise<FaBootstrap>
  upsertIssue(issue: Issue, mutationId?: string): Promise<Issue>
  deleteIssue(issue: Issue, mutationId?: string): Promise<void>
  reorderIssues(issues: Issue[], mutationId?: string): Promise<Issue[]>
  saveGroup(group: MeetingGroup, mutationId?: string): Promise<MeetingGroup>
  finalize(group: MeetingGroup, mutationId?: string): Promise<MeetingGroup>
}
