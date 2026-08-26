import { Link } from 'react-router-dom'
import type { MeetingGroup } from '../../domain/group'
import type { Issue } from '../../domain/issue'
import { formatBangkokTime } from '../../utils/dateTime'
import { StatusBadge } from '../common/StatusBadge'

interface GroupStatusTableProps {
  groups: MeetingGroup[]
  issuesByGroup: Record<string, Issue[]>
}

export function GroupStatusTable({ groups, issuesByGroup }: GroupStatusTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[52rem] w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>{['กลุ่ม', 'ผู้นำเสนอ', 'จำนวนประเด็น', 'บันทึกล่าสุด', 'สถานะ', 'จัดการ'].map((label) => <th key={label} className="px-4 py-3 font-bold">{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {groups.map((group) => (
            <tr key={group.id}>
              <td className="px-4 py-4 font-bold text-slate-950">กลุ่ม {group.groupNo}<span className="mt-1 block max-w-72 text-xs font-normal text-slate-500">{group.groupName}</span></td>
              <td className="px-4 py-4">{group.presenter || '—'}</td>
              <td className="px-4 py-4">{issuesByGroup[group.id]?.length ?? 0}</td>
              <td className="px-4 py-4">{formatBangkokTime(group.updatedAt)} น.</td>
              <td className="px-4 py-4"><StatusBadge status={group.status} /></td>
              <td className="px-4 py-4"><Link to={`/admin/groups/${group.id}`} className="font-bold text-blue-700 hover:underline">เปิดดู</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
