import type { MeetingGroup } from '../../domain/group'
import type { GroupStatus } from '../../domain/status'
import { groupStatusLabels } from '../../content/thai'
import { formatBangkokTime } from '../../utils/dateTime'

interface GroupInfoProps {
  group: MeetingGroup
  issueCount: number
  onChange: (group: MeetingGroup) => void
}

export function GroupInfo({ group, issueCount, onChange }: GroupInfoProps) {
  return (
    <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
      <label className="text-sm font-bold text-slate-800">
        ผู้นำเสนอ
        <input
          aria-label="ผู้นำเสนอ"
          value={group.presenter}
          onChange={(event) => onChange({ ...group, presenter: event.target.value })}
          placeholder="กรอกชื่อผู้นำเสนอ"
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <label className="text-sm font-bold text-slate-800">
        สถานะกลุ่ม
        <select
          aria-label="สถานะกลุ่ม"
          value={group.status}
          onChange={(event) =>
            onChange({ ...group, status: event.target.value as GroupStatus })
          }
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        >
          {Object.entries(groupStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm md:col-span-2">
        <div>
          <dt className="text-slate-500">จำนวนประเด็น</dt>
          <dd className="font-bold text-slate-950">{issueCount} ประเด็น</dd>
        </div>
        <div>
          <dt className="text-slate-500">บันทึกล่าสุด</dt>
          <dd className="font-bold text-slate-950">{formatBangkokTime(group.updatedAt)} น.</dd>
        </div>
      </dl>
    </section>
  )
}
