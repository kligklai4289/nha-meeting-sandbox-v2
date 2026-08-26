import type { MeetingGroup } from '../../domain/group'
import type { Issue } from '../../domain/issue'

export function buildDashboardStats(
  groups: MeetingGroup[],
  issuesByGroup: Record<string, Issue[]>,
) {
  return {
    totalGroups: groups.length,
    totalIssues: groups.reduce(
      (total, group) => total + (issuesByGroup[group.id]?.length ?? 0),
      0,
    ),
    finalizedGroups: groups.filter((group) => group.status === 'final').length,
    latestSavedAt: groups.reduce<string | null>(
      (latest, group) => (!latest || group.updatedAt > latest ? group.updatedAt : latest),
      null,
    ),
  }
}
