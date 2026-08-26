import type { MeetingGroup } from '../domain/group'
import type { Issue } from '../domain/issue'
import type { Meeting, MeetingStatus, MeetingWithGroups, NewMeeting } from '../domain/meeting'
import type { MeetingRepository } from './meetingRepository'
import { createMockSeed, type MockSeed } from './mockSeed'

const STORAGE_KEY = 'fa-meeting-workspace:mock-data:v1'

export class MockMeetingRepository implements MeetingRepository {
  private state: MockSeed
  private otherMeetings: MeetingWithGroups[] = []
  private readonly storage?: Storage

  constructor(
    seed: MockSeed = createMockSeed(),
    storage?: Storage,
  ) {
    this.state = structuredClone(seed)
    this.state.meeting.status ??= this.state.meeting.isActive ? 'active' : 'draft'
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
    const primary = { ...this.state.meeting, groups: this.state.groups }
    const active = [primary, ...this.otherMeetings].find((meeting) => meeting.status === 'active')
    return active ? structuredClone(active) : null
  }

  async listMeetings(): Promise<MeetingWithGroups[]> {
    return structuredClone([{ ...this.state.meeting, groups: this.state.groups }, ...this.otherMeetings])
      .sort((left, right) => right.meetingDate.localeCompare(left.meetingDate))
  }

  async getMeeting(meetingId: string): Promise<MeetingWithGroups | null> {
    return (await this.listMeetings()).find((meeting) => meeting.id === meetingId) ?? null
  }

  async createMeeting(meeting: NewMeeting): Promise<MeetingWithGroups> {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const groups = this.state.groups.map((template) => ({
      ...template,
      id: crypto.randomUUID(),
      meetingId: id,
      presenter: '',
      status: 'draft' as const,
      rowVersion: 1,
      finalizedAt: null,
      createdAt: now,
      updatedAt: now,
    }))
    const created = { ...meeting, id, status: 'draft' as const, isActive: false, createdAt: now, updatedAt: now, groups }
    this.otherMeetings.push(created)
    return structuredClone(created)
  }

  async setMeetingStatus(meetingId: string, status: Extract<MeetingStatus, 'active' | 'closed'>): Promise<Meeting> {
    const all = [{ ...this.state.meeting, groups: this.state.groups }, ...this.otherMeetings]
    const target = all.find((meeting) => meeting.id === meetingId)
    if (!target) throw new Error('ADMIN_MEETING_NOT_FOUND')
    if (status === 'active') {
      this.state.meeting = {
        ...this.state.meeting,
        status: this.state.meeting.id === meetingId ? 'active' : this.state.meeting.status === 'active' ? 'closed' : this.state.meeting.status,
        isActive: this.state.meeting.id === meetingId,
      }
      this.otherMeetings = this.otherMeetings.map((meeting) => ({
        ...meeting,
        status: meeting.id === meetingId ? 'active' : meeting.status === 'active' ? 'closed' : meeting.status,
        isActive: meeting.id === meetingId,
      }))
    }
    if (status === 'closed') {
      if (this.state.meeting.id === meetingId) this.state.meeting = { ...this.state.meeting, status, isActive: false }
      this.otherMeetings = this.otherMeetings.map((meeting) => meeting.id === meetingId ? { ...meeting, status, isActive: false } : meeting)
    }
    this.persist()
    const saved = await this.getMeeting(meetingId)
    if (!saved) throw new Error('ADMIN_MEETING_NOT_FOUND')
    return saved
  }

  async deleteDraftMeeting(meetingId: string): Promise<void> {
    const target = this.otherMeetings.find((meeting) => meeting.id === meetingId)
    if (!target || target.status !== 'draft') throw new Error('ADMIN_MEETING_DELETE_FAILED')
    this.otherMeetings = this.otherMeetings.filter((meeting) => meeting.id !== meetingId)
  }

  async getGroup(groupId: string): Promise<MeetingGroup | null> {
    const group = [...this.state.groups, ...this.otherMeetings.flatMap((meeting) => meeting.groups)]
      .find((candidate) => candidate.id === groupId)
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
    if (this.state.meeting.id === meeting.id) this.state.meeting = structuredClone(meeting)
    else this.otherMeetings = this.otherMeetings.map((candidate) => candidate.id === meeting.id ? { ...candidate, ...structuredClone(meeting) } : candidate)
    this.persist()
    return structuredClone(meeting)
  }

  async saveGroup(group: MeetingGroup): Promise<MeetingGroup> {
    const index = this.state.groups.findIndex((candidate) => candidate.id === group.id)
    if (index >= 0) this.state.groups[index] = structuredClone(group)
    else this.otherMeetings = this.otherMeetings.map((meeting) => ({
      ...meeting,
      groups: meeting.groups.map((candidate) => candidate.id === group.id ? structuredClone(group) : candidate),
    }))
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
    this.otherMeetings = []
    this.persist()
  }
}
