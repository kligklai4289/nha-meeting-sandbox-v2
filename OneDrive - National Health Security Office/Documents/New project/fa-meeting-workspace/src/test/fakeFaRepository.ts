import type { MeetingGroup } from '../domain/group'
import type { Issue } from '../domain/issue'
import type { FaBootstrap, FaRepository } from '../services/faRepository'
import { createMockSeed } from '../services/mockSeed'

export class FakeFaRepository implements FaRepository {
  private readonly data: FaBootstrap

  constructor(groupId = '10000000-0000-4000-8000-000000000001') {
    const seed = createMockSeed()
    const group = seed.groups.find((candidate) => candidate.id === groupId) ?? seed.groups[0]
    this.data = {
      meeting: structuredClone(seed.meeting),
      group: structuredClone(group),
      issues: structuredClone(seed.issues.filter((issue) => issue.groupId === group.id)),
    }
  }

  async createSession(groupId: string) {
    return { meetingId: this.data.meeting.id, groupId, expiresAt: '2026-08-27T13:00:00.000Z' }
  }

  async bootstrap() { return structuredClone(this.data) }
  async upsertIssue(issue: Issue) { return { ...issue, rowVersion: Math.max(1, issue.rowVersion + 1) } }
  async deleteIssue() {}
  async reorderIssues(issues: Issue[]) { return issues.map((issue) => ({ ...issue, rowVersion: issue.rowVersion + 1 })) }
  async saveGroup(group: MeetingGroup) { return { ...group, rowVersion: group.rowVersion + 1 } }
  async finalize(group: MeetingGroup) {
    return { ...group, status: 'final' as const, rowVersion: group.rowVersion + 1, finalizedAt: new Date().toISOString() }
  }
}
