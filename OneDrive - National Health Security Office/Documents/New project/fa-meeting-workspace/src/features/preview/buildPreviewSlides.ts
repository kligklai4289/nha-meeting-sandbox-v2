import type { MeetingGroup } from '../../domain/group'
import type { Issue } from '../../domain/issue'

export interface PreviewSlide {
  kind: 'cover' | 'issue'
  issueId?: string
  index: number
}

export function buildPreviewSlides(_group: MeetingGroup, issues: Issue[]): PreviewSlide[] {
  const orderedIssues = [...issues].sort((left, right) => left.sortOrder - right.sortOrder)
  return [
    { kind: 'cover', index: 0 },
    ...orderedIssues.map((issue, index) => ({
      kind: 'issue' as const,
      issueId: issue.id,
      index: index + 1,
    })),
  ]
}
