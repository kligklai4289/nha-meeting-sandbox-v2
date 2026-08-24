import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { MeetingForm } from '../../components/admin/MeetingForm'
import type { Meeting } from '../../domain/meeting'
import { useMeetingRepository } from '../../services/useMeetingRepository'

export function AdminMeetingDetailPage() {
  const { meetingId } = useParams()
  const repository = useMeetingRepository()
  const [meeting, setMeeting] = useState<Meeting | null>()
  useEffect(() => { repository.getMeeting(meetingId ?? '').then(setMeeting) }, [meetingId, repository])
  if (meeting === null) return <Navigate to="/admin/meetings" replace />
  if (!meeting) return <main className="p-8">กำลังโหลดรายละเอียด...</main>
  return <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-8"><Link to="/admin/meetings" className="text-sm font-bold text-blue-700">← กลับไปจัดการรอบประชุม</Link><h1 className="mb-2 mt-4 text-3xl font-black text-slate-950">แก้ไขรอบประชุม</h1><p className="mb-6 text-sm text-slate-600">สถานะ: {meeting.status === 'active' ? 'กำลังใช้งาน' : meeting.status === 'closed' ? 'ปิดแล้ว' : 'แบบร่าง'}</p><MeetingForm meeting={meeting} onSave={async (next) => { setMeeting(await repository.saveMeeting(next)) }} /></main>
}
