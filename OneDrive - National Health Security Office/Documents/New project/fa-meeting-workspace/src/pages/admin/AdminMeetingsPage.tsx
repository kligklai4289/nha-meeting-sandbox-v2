import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NewMeetingForm } from '../../components/admin/NewMeetingForm'
import { Button } from '../../components/common/Button'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import type { MeetingStatus, MeetingWithGroups } from '../../domain/meeting'
import { useMeetingRepository } from '../../services/useMeetingRepository'

type PendingAction = {
  type: 'activate' | 'close' | 'delete'
  meeting: MeetingWithGroups
}

const statusLabels: Record<MeetingStatus, string> = {
  draft: 'แบบร่าง',
  active: 'กำลังใช้งาน',
  closed: 'ปิดแล้ว',
}

const statusClasses: Record<MeetingStatus, string> = {
  draft: 'bg-amber-50 text-amber-800',
  active: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-slate-100 text-slate-700',
}

export function AdminMeetingsPage() {
  const repository = useMeetingRepository()
  const [meetings, setMeetings] = useState<MeetingWithGroups[]>()
  const [showCreate, setShowCreate] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setMeetings(await repository.listMeetings())
      setError(null)
    } catch {
      setError('ไม่สามารถโหลดรายการรอบประชุมได้ กรุณาลองอีกครั้ง')
    }
  }, [repository])

  useEffect(() => {
    repository.listMeetings().then(
      (data) => setMeetings(data),
      () => setError('ไม่สามารถโหลดรายการรอบประชุมได้ กรุณาลองอีกครั้ง'),
    )
  }, [repository])

  const runPendingAction = async () => {
    if (!pending || working) return
    setWorking(true)
    setError(null)
    setMessage(null)
    try {
      if (pending.type === 'delete') {
        await repository.deleteDraftMeeting(pending.meeting.id)
        setMessage(`ลบรอบ “${pending.meeting.title}” แล้ว`)
      } else {
        await repository.setMeetingStatus(pending.meeting.id, pending.type === 'activate' ? 'active' : 'closed')
        setMessage(pending.type === 'activate' ? `เปิดใช้งานรอบ “${pending.meeting.title}” แล้ว` : `ปิดรอบ “${pending.meeting.title}” แล้ว`)
      }
      await load()
    } catch {
      setError('ดำเนินการไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง')
    } finally {
      setWorking(false)
      setPending(null)
    }
  }

  if (meetings === undefined && !error) return <main className="p-8">กำลังโหลดรอบประชุม...</main>

  return (
    <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-blue-700">การบริหารรอบประชุม</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">จัดการรอบประชุม</h1>
        </div>
        <Button onClick={() => setShowCreate((current) => !current)}>{showCreate ? 'ปิดแบบฟอร์ม' : 'สร้างรอบประชุมใหม่'}</Button>
      </div>

      {showCreate ? (
        <NewMeetingForm
          onCancel={() => setShowCreate(false)}
          onCreate={async (meeting) => {
            await repository.createMeeting(meeting)
            setShowCreate(false)
            setMessage(`สร้างรอบ “${meeting.title}” เป็นแบบร่างแล้ว`)
            await load()
          }}
        />
      ) : null}

      {error ? <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}
      {message ? <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</p> : null}

      <section className="mt-6 grid gap-4">
        {meetings?.length ? meetings.map((meeting) => (
          <article key={meeting.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses[meeting.status]}`}>{statusLabels[meeting.status]}</span>
                <h2 className="mt-4 text-xl font-black text-slate-950">{meeting.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{meeting.meetingDate} · {meeting.startTime}–{meeting.endTime} น. · ปีงบประมาณ {meeting.fiscalYear}</p>
                <p className="mt-1 text-sm text-slate-600">{meeting.groups.length} กลุ่ม · {meeting.location}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/admin/meetings/${meeting.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50">แก้ไข</Link>
                {meeting.status === 'active' ? (
                  <Button variant="secondary" onClick={() => setPending({ type: 'close', meeting })}>ปิดรอบ</Button>
                ) : (
                  <Button variant="success" onClick={() => setPending({ type: 'activate', meeting })}>{meeting.status === 'closed' ? 'เปิดใช้งานอีกครั้ง' : 'เปิดใช้งาน'}</Button>
                )}
                {meeting.status === 'draft' ? <Button variant="danger" onClick={() => setPending({ type: 'delete', meeting })}>ลบแบบร่าง</Button> : null}
              </div>
            </div>
          </article>
        )) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">ยังไม่มีรอบประชุม กด “สร้างรอบประชุมใหม่” เพื่อเริ่มต้น</div>}
      </section>

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.type === 'delete' ? 'ยืนยันการลบรอบแบบร่าง' : pending?.type === 'close' ? 'ยืนยันการปิดรอบประชุม' : 'ยืนยันการเปิดใช้งานรอบประชุม'}
        confirmLabel={working ? 'กำลังดำเนินการ...' : pending?.type === 'delete' ? 'ลบรอบแบบร่าง' : pending?.type === 'close' ? 'ปิดรอบประชุม' : 'เปิดใช้งานรอบนี้'}
        destructive={pending?.type !== 'activate'}
        onCancel={() => { if (!working) setPending(null) }}
        onConfirm={() => { void runPendingAction() }}
      >
        {pending?.type === 'delete'
          ? 'ลบได้เฉพาะรอบแบบร่างที่ยังไม่มีข้อมูล การดำเนินการนี้ย้อนกลับไม่ได้'
          : pending?.type === 'close'
            ? 'FA จะไม่สามารถบันทึกข้อมูลในรอบนี้ต่อได้ แต่ข้อมูลเดิมและไฟล์ Export ยังคงอยู่'
            : 'หากมีรอบอื่นกำลังใช้งาน ระบบจะปิดรอบนั้นและยกเลิก Session FA เดิมโดยอัตโนมัติ'}
      </ConfirmDialog>
    </main>
  )
}
