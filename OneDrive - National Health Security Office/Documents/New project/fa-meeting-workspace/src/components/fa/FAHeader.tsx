import { ArrowLeft, Cloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MeetingGroup } from '../../domain/group'

interface FAHeaderProps {
  group: MeetingGroup
  onBack: () => void
}

export function FAHeader({ group, onBack }: FAHeaderProps) {
  return (
    <header className="rounded-2xl bg-government-navy p-5 text-white shadow-lg sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/fa"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-blue-100 hover:text-white"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            กลับไปเลือกกลุ่ม
          </Link>
          <p className="mt-3 text-sm font-semibold text-blue-200">FA Workspace</p>
          <h2 className="mt-1 text-2xl font-bold leading-9">
            กลุ่ม {group.groupNo} {group.groupName}
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-blue-50">
          <Cloud aria-hidden="true" size={16} />
          พร้อมบันทึกอัตโนมัติ
        </div>
      </div>
      <p className="mt-4 max-w-5xl text-sm leading-6 text-blue-100">
        {group.groupDescription}
      </p>
    </header>
  )
}
