import type { MeetingGroup } from '../domain/group'
import type { Issue } from '../domain/issue'
import type { Meeting, MeetingWithGroups } from '../domain/meeting'
import type { MeetingRepository } from './meetingRepository'
import { createMockSeed, type MockSeed } from './mockSeed'

export class MockMeetingRepository implements MeetingRepository {
  private state: MockSeed

  constructor(seed: MockSeed = createMockSeed()) {
    this.state = structuredClone(seed)
  }

  async getActiveMeeting(): Promise<MeetingWithGroups | null> {
    if (!this.state.meeting.isActive) return null
    return structuredClone({
      ...this.state.meeting,
      groups: this.state.groups,
    })
  }

  async getGroup(groupId: string): Promise<MeetingGroup | null> {
    const group = this.state.groups.find((candidate) => candidate.id === groupId)
    return group ? structuredClone(group) : null
  }

  async getIssues(groupId: string): Promise<Issue[]> {
    return structuredClone(
      this.state.issues
        .filter((issue) => issue.groupId === groupId)
        .sort((left, right) => left.sortOrder - right.sortOrder),
    )
  }

  async saveMeeting(meeting: Meeting): Promise<Meeting> {
    this.state.meeting = structuredClone(meeting)
    return structuredClone(meeting)
  }

  async saveGroup(group: MeetingGroup): Promise<MeetingGroup> {
    const index = this.state.groups.findIndex((candidate) => candidate.id === group.id)
    if (index >= 0) this.state.groups[index] = structuredClone(group)
    else this.state.groups.push(structuredClone(group))
    return structuredClone(group)
  }

  async saveIssues(groupId: string, issues: Issue[]): Promise<Issue[]> {
    this.state.issues = [
      ...this.state.issues.filter((issue) => issue.groupId !== groupId),
      ...structuredClone(issues),
    ]
    return structuredClone(issues)
  }
}
