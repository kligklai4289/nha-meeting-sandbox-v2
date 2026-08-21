import { useEffect, useState } from 'react'
import { MeetingForm } from '../../components/admin/MeetingForm'
import { Button } from '../../components/common/Button'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import type { Meeting } from '../../domain/meeting'
import { useMeetingRepository } from '../../services/useMeetingRepository'

export function AdminSettingsPage() {
  const repository = useMeetingRepository()
  const [meeting, setMeeting] = useState<Meeting | null>()
  const [resetOpen, setResetOpen] = useState(false)
  const [resetComplete, setResetComplete] = useState(false)
  useEffect(() => { repository.getActiveMeeting().then(setMeeting) }, [repository])
  if (meeting === undefined) return <main className="p-8">กำลังโหลดการตั้งค่า...</main>
  if (meeting === null) return <main className="p-8">ไม่พบรอบประชุมที่เปิดใช้งาน</main>
  const resetTrialData = async () => {
    await repository.reset()
    setMeeting(await repository.getActiveMeeting())
    setResetOpen(false)
    setResetComplete(true)
  }
  return (
    <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-sm font-bold text-blue-700">การตั้งค่า Phase 1</p>
      <h1 className="mb-6 mt-1 text-3xl font-black text-slate-950">ตั้งค่ารอบประชุม</h1>
      <MeetingForm
        key={meeting.updatedAt}
        meeting={meeting}
        onSave={async (next) => { setResetComplete(false); setMeeting(await repository.saveMeeting(next)) }}
      />
      <section className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-black text-red-950">จัดการข้อมูลทดลอง</h2>
        <p className="mt-2 text-sm leading-6 text-red-800">
          ล้างข้อมูลที่กรอกทุกกลุ่มและคืนค่าเริ่มต้น การดำเนินการนี้ย้อนกลับไม่ได้
        </p>
        {resetComplete && <p role="status" className="mt-3 text-sm font-bold text-emerald-700">ล้างข้อมูลทดลองแล้ว</p>}
        <Button variant="danger" className="mt-4" onClick={() => setResetOpen(true)}>
          ล้างข้อมูลทดลอง
        </Button>
      </section>
      <ConfirmDialog
        open={resetOpen}
        title="ล้างข้อมูลทดลองทั้งหมด?"
        confirmLabel="ยืนยันล้างข้อมูล"
        destructive
        onCancel={() => setResetOpen(false)}
        onConfirm={() => { void resetTrialData() }}
      >
        ข้อมูลที่กรอกทั้ง 3 กลุ่มและการตั้งค่ารอบประชุมจะกลับเป็นข้อมูลตัวอย่าง
      </ConfirmDialog>
    </main>
  )
}
