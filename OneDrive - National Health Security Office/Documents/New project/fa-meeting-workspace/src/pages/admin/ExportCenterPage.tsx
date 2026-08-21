import { useEffect, useState } from 'react'
import { DraftExportDialog } from '../../components/admin/DraftExportDialog'
import { ExportCard } from '../../components/admin/ExportCard'
import { Button } from '../../components/common/Button'
import type { MeetingGroup } from '../../domain/group'
import { useMeetingRepository } from '../../services/useMeetingRepository'

interface ExportData {
  groups: MeetingGroup[]
  issueCounts: Record<string, number>
}

export function ExportCenterPage() {
  const repository = useMeetingRepository()
  const [data, setData] = useState<ExportData>()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [draftRequest, setDraftRequest] = useState<'group' | 'combined' | null>(null)
  useEffect(() => {
    repository.getActiveMeeting().then(async (meeting) => {
      if (!meeting) return
      const counts = await Promise.all(meeting.groups.map(async (group) => (await repository.getIssues(group.id)).length))
      setData({ groups: meeting.groups, issueCounts: Object.fromEntries(meeting.groups.map((group, index) => [group.id, counts[index]])) })
    })
  }, [repository])
  if (!data) return <main className="p-8">กำลังโหลด Export Center...</main>
  const excelFeedback = () => setFeedback('ตัวอย่าง: จะสร้างไฟล์ Excel ใน Phase Export')
  const powerpointFeedback = () => setFeedback('ตัวอย่าง: จะสร้างไฟล์ PowerPoint ใน Phase Export')
  return (
    <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-sm font-bold text-blue-700">Mock Export — ยังไม่สร้างไฟล์จริง</p>
      <h1 className="mt-1 text-3xl font-black text-slate-950">Export Center</h1>
      {feedback && <p role="status" className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{feedback}</p>}
      <div className="mt-6 grid gap-4 xl:grid-cols-3">{data.groups.map((group) => <ExportCard key={group.id} group={group} issueCount={data.issueCounts[group.id] ?? 0} onExcel={excelFeedback} onPowerPoint={() => group.status === 'final' ? powerpointFeedback() : setDraftRequest('group')} />)}</div>
      <section className="mt-8 rounded-2xl bg-government-navy p-6 text-white"><h2 className="text-xl font-black">Export รวมทุกกลุ่ม</h2><p className="mt-2 text-sm text-blue-100">รวมข้อมูล 3 กลุ่มในไฟล์ตัวอย่างเดียว</p><div className="mt-5 flex flex-wrap gap-3"><Button variant="secondary" onClick={excelFeedback}>Export Excel รวม 3 กลุ่ม</Button><Button variant="success" onClick={() => data.groups.some((group) => group.status !== 'final') ? setDraftRequest('combined') : powerpointFeedback()}>Export PowerPoint รวม 3 กลุ่ม</Button></div></section>
      <DraftExportDialog open={draftRequest !== null} onCancel={() => setDraftRequest(null)} onConfirm={() => { setDraftRequest(null); powerpointFeedback() }} />
    </main>
  )
}
