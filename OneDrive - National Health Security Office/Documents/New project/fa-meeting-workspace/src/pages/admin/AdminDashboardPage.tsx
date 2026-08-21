import { CheckCircle2, Clock3, Layers3, ListChecks } from 'lucide-react'
import { useEffect, useState } from 'react'
import { GroupStatusTable } from '../../components/admin/GroupStatusTable'
import { StatCard } from '../../components/admin/StatCard'
import type { MeetingGroup } from '../../domain/group'
import type { Issue } from '../../domain/issue'
import { buildDashboardStats } from '../../features/admin/buildDashboardStats'
import { useMeetingRepository } from '../../services/useMeetingRepository'
import { formatBangkokTime } from '../../utils/dateTime'

interface DashboardData {
  groups: MeetingGroup[]
  issuesByGroup: Record<string, Issue[]>
}

export function AdminDashboardPage() {
  const repository = useMeetingRepository()
  const [data, setData] = useState<DashboardData>()
  useEffect(() => {
    let active = true
    repository.getActiveMeeting().then(async (meeting) => {
      if (!meeting || !active) return
      const issueLists = await Promise.all(meeting.groups.map((group) => repository.getIssues(group.id)))
      if (!active) return
      setData({
        groups: meeting.groups,
        issuesByGroup: Object.fromEntries(meeting.groups.map((group, index) => [group.id, issueLists[index]])),
      })
    })
    return () => { active = false }
  }, [repository])

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
      <h2 className="mb-3 mt-8 text-xl font-black text-slate-950">สถานะรายกลุ่ม</h2>
      <GroupStatusTable groups={data.groups} issuesByGroup={data.issuesByGroup} />
    </main>
  )
}
