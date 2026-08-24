import type { MeetingGroup } from '../domain/group'
import type { Issue } from '../domain/issue'
import type { Meeting, MeetingWithGroups } from '../domain/meeting'
import type { MeetingRepository } from './meetingRepository'
import { createMockSeed, type MockSeed } from './mockSeed'

const STORAGE_KEY = 'fa-meeting-workspace:mock-data:v1'

export class MockMeetingRepository implements MeetingRepository {
  private state: MockSeed
  private readonly storage?: Storage

  constructor(
    seed: MockSeed = createMockSeed(),
    storage?: Storage,
  ) {
    this.state = structuredClone(seed)
    this.storage = storage
  }

  static fromStorage(storage: Storage): MockMeetingRepository {
    const stored = storage.getItem(STORAGE_KEY)
    if (!stored) return new MockMeetingRepository(createMockSeed(), storage)
    try {
      return new MockMeetingRepository(JSON.parse(stored) as MockSeed, storage)
    } catch {
      return new MockMeetingRepository(createMockSeed(), storage)
    }
  }

  private persist(): void {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.state))
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
    this.persist()
    return structuredClone(meeting)
  }

  async saveGroup(group: MeetingGroup): Promise<MeetingGroup> {
    const index = this.state.groups.findIndex((candidate) => candidate.id === group.id)
    if (index >= 0) this.state.groups[index] = structuredClone(group)
    else this.state.groups.push(structuredClone(group))
    this.persist()
    return structuredClone(group)
  }

  async saveIssues(groupId: string, issues: Issue[]): Promise<Issue[]> {
    this.state.issues = [
      ...this.state.issues.filter((issue) => issue.groupId !== groupId),
      ...structuredClone(issues),
    ]
    this.persist()
    return structuredClone(issues)
  }

  async saveGroupBundle(group: MeetingGroup, issues: Issue[]) {
    const savedGroup = await this.saveGroup(group)
    const savedIssues = await this.saveIssues(group.id, issues)
    return { group: savedGroup, issues: savedIssues }
  }

  subscribe(): () => void {
    return () => undefined
  }

  async reset(): Promise<void> {
    this.state = createMockSeed()
    this.persist()
  }
}
