import type { GroupStatus } from '../../domain/status'
import { groupStatusLabels } from '../../content/thai'
import { cn } from '../../utils/cn'

interface StatusBadgeProps {
  status: GroupStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-bold',
        status === 'draft' && 'bg-amber-50 text-amber-800',
        status === 'review_ready' && 'bg-blue-50 text-blue-700',
        status === 'final' && 'bg-emerald-50 text-emerald-700',
      )}
    >
      {groupStatusLabels[status]}
    </span>
  )
}
