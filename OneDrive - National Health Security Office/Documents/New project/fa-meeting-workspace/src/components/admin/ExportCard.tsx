import { FileDown, FileSpreadsheet } from 'lucide-react'
import type { MeetingGroup } from '../../domain/group'
import { Button } from '../common/Button'
import { StatusBadge } from '../common/StatusBadge'

interface ExportCardProps {
  group: MeetingGroup
  issueCount: number
  onExcel: () => void
  onPowerPoint: () => void
}

export function ExportCard({ group, issueCount, onExcel, onPowerPoint }: ExportCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-black text-slate-950">กลุ่ม {group.groupNo}</h2><p className="mt-1 text-sm text-slate-600">{group.groupName}</p></div>
        <StatusBadge status={group.status} />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-600">{issueCount} ประเด็น</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onExcel} aria-label={`Export Excel กลุ่ม ${group.groupNo}`}><FileSpreadsheet aria-hidden="true" size={17} /> Excel</Button>
        <Button onClick={onPowerPoint} aria-label={`Export PowerPoint กลุ่ม ${group.groupNo}`}><FileDown aria-hidden="true" size={17} /> PowerPoint</Button>
      </div>
    </article>
  )
}
