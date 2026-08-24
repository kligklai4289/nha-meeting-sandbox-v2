import { ArrowRight, CheckCircle2, Clock3, FileSpreadsheet, Layers3, ListChecks, Presentation } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GroupStatusTable } from '../../components/admin/GroupStatusTable'
import { StatCard } from '../../components/admin/StatCard'
import type { MeetingGroup } from '../../domain/group'
import type { Issue } from '../../domain/issue'
import { buildDashboardStats } from '../../features/admin/buildDashboardStats'
import { useMeetingRepository } from '../../services/useMeetingRepository'
import { formatBangkokTime } from '../../utils/dateTime'
import { useRealtimeMeeting } from '../../hooks/useRealtimeMeeting'

interface DashboardData {
  groups: MeetingGroup[]
  issuesByGroup: Record<string, Issue[]>
}

export function AdminDashboardPage() {
  const repository = useMeetingRepository()
  const [data, setData] = useState<DashboardData>()
  const [meetingId, setMeetingId] = useState<string | null>(null)
  const load = useCallback(async () => {
    const meeting = await repository.getActiveMeeting()
    if (!meeting) return
    const issueLists = await Promise.all(meeting.groups.map((group) => repository.getIssues(group.id)))
    setMeetingId(meeting.id)
    setData({
      groups: meeting.groups,
      issuesByGroup: Object.fromEntries(meeting.groups.map((group, index) => [group.id, issueLists[index]])),
    })
  }, [repository])
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])
  const refresh = useCallback(() => { void load() }, [load])
  useRealtimeMeeting(repository, meetingId, refresh)

  if (!data) return <main className="p-8">กำลังโหลด Dashboard...</main>
  const stats = buildDashboardStats(data.groups, data.issuesByGroup)
  return (
    <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-sm font-bold text-blue-700">ภาพรวมรอบประชุมปัจจุบัน</p>
      <h1 className="mt-1 text-3xl font-black text-slate-950">Admin Dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="กลุ่มทั้งหมด" value={stats.totalGroups} icon={Layers3} />
        <StatCard label="ประเด็นทั้งหมด" value={stats.totalIssues} icon={ListChecks} />
        <StatCard label="Final แล้ว" value={stats.finalizedGroups} icon={CheckCircle2} />
        <StatCard label="บันทึกล่าสุด" value={stats.latestSavedAt ? `${formatBangkokTime(stats.latestSavedAt)} น.` : '—'} icon={Clock3} />
      </div>
      <section className="mt-8 overflow-hidden rounded-2xl bg-government-navy text-white shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-bold text-blue-200">ส่งออกรายงาน</p>
            <h2 className="mt-1 text-xl font-black">สรุปข้อมูลทั้ง {stats.totalGroups} กลุ่ม</h2>
            <p className="mt-2 max-w-2xl text-sm text-blue-100">
              ดาวน์โหลด Excel หรือ PowerPoint จากข้อมูลล่าสุดผ่าน Export Center
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/export" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800">
              <FileSpreadsheet aria-hidden="true" size={18} />
              Export Excel
            </Link>
            <Link to="/admin/export" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
              <Presentation aria-hidden="true" size={18} />
              Export PowerPoint
            </Link>
          </div>
        </div>
        <div className="border-t border-white/15 bg-black/10 px-6 py-4">
          <Link
            to="/admin/export"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white underline decoration-blue-300 underline-offset-4"
          >
            ดูตัวเลือก Export รายกลุ่ม
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>
      </section>
      <h2 className="mb-3 mt-8 text-xl font-black text-slate-950">สถานะรายกลุ่ม</h2>
      <GroupStatusTable groups={data.groups} issuesByGroup={data.issuesByGroup} />
    </main>
  )
}
