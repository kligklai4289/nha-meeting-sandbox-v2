import { useEffect, useState } from 'react'
import { MeetingForm } from '../../components/admin/MeetingForm'
import type { Meeting } from '../../domain/meeting'
import { useMeetingRepository } from '../../services/useMeetingRepository'

export function AdminSettingsPage() {
  const repository = useMeetingRepository()
  const [meeting, setMeeting] = useState<Meeting | null>()
  useEffect(() => { repository.getActiveMeeting().then(setMeeting) }, [repository])
  if (meeting === undefined) return <main className="p-8">กำลังโหลดการตั้งค่า...</main>
  if (meeting === null) return <main className="p-8">ไม่พบรอบประชุมที่เปิดใช้งาน</main>
  return <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-8"><p className="text-sm font-bold text-blue-700">การตั้งค่า Phase 1</p><h1 className="mb-6 mt-1 text-3xl font-black text-slate-950">ตั้งค่ารอบประชุม</h1><MeetingForm meeting={meeting} onSave={async (next) => { setMeeting(await repository.saveMeeting(next)) }} /></main>
}
