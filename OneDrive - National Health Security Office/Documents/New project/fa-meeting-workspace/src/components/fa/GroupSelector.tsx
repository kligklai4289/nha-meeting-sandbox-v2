import { ArrowRight, Users } from 'lucide-react'
import type { MeetingGroup } from '../../domain/group'

interface GroupSelectorProps {
  groups: MeetingGroup[]
  onSelect: (groupId: string) => void
}

export function GroupSelector({ groups, onSelect }: GroupSelectorProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          aria-label={`เลือกกลุ่ม ${group.groupNo}: ${group.groupName}`}
          onClick={() => onSelect(group.id)}
          className="group flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          <span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Users aria-hidden="true" size={24} />
          </span>
          <span className="mt-6 text-sm font-bold text-blue-700">กลุ่ม {group.groupNo}</span>
          <span className="mt-2 text-xl font-bold leading-8 text-slate-950">
            {group.groupName}
          </span>
          <span className="mt-3 flex-1 text-sm leading-6 text-slate-600">
            {group.groupDescription}
          </span>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700">
            เริ่มบันทึก
            <ArrowRight aria-hidden="true" size={17} className="transition group-hover:translate-x-1" />
          </span>
        </button>
      ))}
    </div>
  )
}
