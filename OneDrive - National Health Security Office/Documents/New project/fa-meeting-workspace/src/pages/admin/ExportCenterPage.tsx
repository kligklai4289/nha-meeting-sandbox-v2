import { useEffect, useState } from 'react'
import { DraftExportDialog } from '../../components/admin/DraftExportDialog'
import { ExportCard } from '../../components/admin/ExportCard'
import { Button } from '../../components/common/Button'
import type { MeetingGroup } from '../../domain/group'
import { exportService } from '../../services/exportClient'
import { useMeetingRepository } from '../../services/useMeetingRepository'

interface ExportData {
  groups: MeetingGroup[]
  issueCounts: Record<string, number>
}

export function ExportCenterPage() {
  const repository = useMeetingRepository()
  const [data, setData] = useState<ExportData>()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [draftRequest, setDraftRequest] = useState<{ format: 'excel' | 'powerpoint'; scope: 'group' | 'all'; groupId?: string } | null>(null)
  useEffect(() => {
    repository.getActiveMeeting().then(async (meeting) => {
      if (!meeting) return
      const counts = await Promise.all(meeting.groups.map(async (group) => (await repository.getIssues(group.id)).length))
      setData({ groups: meeting.groups, issueCounts: Object.fromEntries(meeting.groups.map((group, index) => [group.id, counts[index]])) })
    })
  }, [repository])
  if (!data) return <main className="p-8">กำลังโหลด Export Center...</main>
  const runExport = async (format: 'excel' | 'powerpoint', scope: 'group' | 'all', groupId?: string, draft = false) => {
    setBusy(true); setFeedback('กำลังสร้างไฟล์ กรุณารอสักครู่...')
    try { await exportService.download(format, scope, groupId, draft); setFeedback('สร้างไฟล์และเริ่มดาวน์โหลดแล้ว') }
    catch { setFeedback('ไม่สามารถสร้างไฟล์ได้ กรุณาลองอีกครั้ง') }
    finally { setBusy(false) }
  }
  const requestExport = (format: 'excel' | 'powerpoint', scope: 'group' | 'all', groupId?: string) => {
    const selected = scope === 'group' ? data.groups.filter((group) => group.id === groupId) : data.groups
    if (selected.some((group) => group.status !== 'final')) setDraftRequest({ format, scope, groupId })
    else void runExport(format, scope, groupId)
  }
  return (
    <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-sm font-bold text-blue-700">ส่งออกรายงานจริงจากข้อมูลล่าสุด</p>
      <h1 className="mt-1 text-3xl font-black text-slate-950">Export Center</h1>
      {feedback && <p role="status" className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{feedback}</p>}
      <div className={`mt-6 grid gap-4 xl:grid-cols-3 ${busy ? 'pointer-events-none opacity-60' : ''}`}>{data.groups.map((group) => <ExportCard key={group.id} group={group} issueCount={data.issueCounts[group.id] ?? 0} onExcel={() => requestExport('excel', 'group', group.id)} onPowerPoint={() => requestExport('powerpoint', 'group', group.id)} />)}</div>
      <section className="mt-8 rounded-2xl bg-government-navy p-6 text-white"><h2 className="text-xl font-black">Export รวมทุกกลุ่ม</h2><p className="mt-2 text-sm text-blue-100">รวมข้อมูล 3 กลุ่มจาก snapshot เดียวในไฟล์เดียว</p><div className="mt-5 flex flex-wrap gap-3"><Button variant="secondary" disabled={busy} onClick={() => requestExport('excel', 'all')}>Export Excel รวม 3 กลุ่ม</Button><Button variant="success" disabled={busy} onClick={() => requestExport('powerpoint', 'all')}>Export PowerPoint รวม 3 กลุ่ม</Button></div></section>
      <DraftExportDialog open={draftRequest !== null} onCancel={() => setDraftRequest(null)} onConfirm={() => { const request = draftRequest; setDraftRequest(null); if (request) void runExport(request.format, request.scope, request.groupId, true) }} />
    </main>
  )
}
