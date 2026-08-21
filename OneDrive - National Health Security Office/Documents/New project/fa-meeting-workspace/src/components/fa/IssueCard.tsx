import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { issueFieldLabels } from '../../content/thai'
import type { Issue } from '../../domain/issue'
import { Button } from '../common/Button'

type EditableField = keyof Pick<
  Issue,
  'topic' | 'findings' | 'proposal' | 'actionPlan' | 'monitoring' | 'stakeholderRoles'
>

interface IssueCardProps {
  issue: Issue
  isFirst: boolean
  isLast: boolean
  onUpdate: (issueId: string, field: EditableField, value: string) => void
  onMoveUp: (issueId: string) => void
  onMoveDown: (issueId: string) => void
  onDelete: (issueId: string) => void
}

const longFields: EditableField[] = [
  'findings',
  'proposal',
  'actionPlan',
  'monitoring',
  'stakeholderRoles',
]

export function IssueCard({
  issue,
  isFirst,
  isLast,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDelete,
}: IssueCardProps) {
  const titleId = `issue-title-${issue.id}`
  return (
    <section
      role="group"
      aria-labelledby={titleId}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <h3 id={titleId} className="text-lg font-bold text-slate-950">
          ประเด็นที่ {issue.sortOrder}
        </h3>
        <div className="flex gap-2">
          <Button variant="ghost" aria-label="เลื่อนประเด็นขึ้น" disabled={isFirst} onClick={() => onMoveUp(issue.id)}>
            <ArrowUp aria-hidden="true" size={17} />
          </Button>
          <Button variant="ghost" aria-label="เลื่อนประเด็นลง" disabled={isLast} onClick={() => onMoveDown(issue.id)}>
            <ArrowDown aria-hidden="true" size={17} />
          </Button>
          <Button variant="ghost" aria-label="ลบประเด็น" onClick={() => onDelete(issue.id)}>
            <Trash2 aria-hidden="true" size={17} className="text-red-600" />
          </Button>
        </div>
      </div>
      <label className="mt-5 block text-sm font-bold text-slate-800">
        {issueFieldLabels.topic}
        <input
          aria-label={issueFieldLabels.topic}
          value={issue.topic}
          onChange={(event) => onUpdate(issue.id, 'topic', event.target.value)}
          placeholder="ระบุประเด็น"
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {longFields.map((field) => (
          <label
            key={field}
            className={`text-sm font-bold text-slate-800 ${field === 'stakeholderRoles' ? 'md:col-span-2' : ''}`}
          >
            {issueFieldLabels[field]}
            <textarea
              aria-label={issueFieldLabels[field]}
              value={issue[field]}
              onChange={(event) => onUpdate(issue.id, field, event.target.value)}
              rows={field === 'stakeholderRoles' ? 4 : 5}
              className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 font-normal leading-6 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        ))}
      </div>
    </section>
  )
}
