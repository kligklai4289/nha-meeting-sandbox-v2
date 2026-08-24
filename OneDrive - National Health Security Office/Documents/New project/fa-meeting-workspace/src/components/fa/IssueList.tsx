import type { Issue } from '../../domain/issue'
import { IssueCard } from './IssueCard'

type EditableField = keyof Pick<
  Issue,
  'topic' | 'findings' | 'proposal' | 'actionPlan' | 'monitoring' | 'stakeholderRoles'
>

interface IssueListProps {
  issues: Issue[]
  onUpdate: (issueId: string, field: EditableField, value: string) => void
  onMoveUp: (issueId: string) => void
  onMoveDown: (issueId: string) => void
  onDelete: (issueId: string) => void
  disabled?: boolean
  reorderDisabled?: boolean
}

export function IssueList(props: IssueListProps) {
  return (
    <div className="space-y-5">
      {props.issues.map((issue, index) => (
        <IssueCard
          key={issue.id}
          issue={issue}
          isFirst={index === 0}
          isLast={index === props.issues.length - 1}
          onUpdate={props.onUpdate}
          onMoveUp={props.onMoveUp}
          onMoveDown={props.onMoveDown}
          onDelete={props.onDelete}
          disabled={props.disabled}
          reorderDisabled={props.reorderDisabled}
        />
      ))}
    </div>
  )
}
