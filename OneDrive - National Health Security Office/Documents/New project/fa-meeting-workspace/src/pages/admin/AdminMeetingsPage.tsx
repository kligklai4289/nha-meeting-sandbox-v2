import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MeetingWithGroups } from '../../domain/meeting'
import { useMeetingRepository } from '../../services/useMeetingRepository'

export function AdminMeetingsPage() {
  const repository = useMeetingRepository()
  const [meeting, setMeeting] = useState<MeetingWithGroups | null>()
  useEffect(() => { repository.getActiveMeeting().then(setMeeting) }, [repository])
  if (meeting === undefined) return <main className="p-8">กำลังโหลดรอบประชุม...</main>
  return (
    <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-black text-slate-950">จัดการรอบประชุม</h1>
      {meeting ? <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">กำลังใช้งาน</span><h2 className="mt-4 text-xl font-black">{meeting.title}</h2><p className="mt-2 text-sm text-slate-600">ปีงบประมาณ {meeting.fiscalYear} · {meeting.groups.length} กลุ่ม · {meeting.location}</p><Link to={`/admin/meetings/${meeting.id}`} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white">แก้ไขรอบประชุม</Link></section> : <p className="mt-6">ยังไม่มีรอบประชุมที่เปิดใช้งาน</p>}
    </main>
  )
}
