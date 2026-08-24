import { useState, type FormEvent } from 'react'
import type { NewMeeting } from '../../domain/meeting'
import { Button } from '../common/Button'

interface NewMeetingFormProps {
  onCreate: (meeting: NewMeeting) => Promise<void>
  onCancel: () => void
}

const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)

export function NewMeetingForm({ onCreate, onCancel }: NewMeetingFormProps) {
  const [draft, setDraft] = useState<NewMeeting>({
    title: '',
    fiscalYear: String(Number(today.slice(0, 4)) + 543),
    meetingDate: today,
    startTime: '09:00',
    endTime: '16:30',
    location: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const field = (key: keyof NewMeeting, label: string, type = 'text') => (
    <label className="text-sm font-bold text-slate-700">
      {label}
      <input
        aria-label={label}
        type={type}
        required
        value={draft[key]}
        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
        className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal"
      />
    </label>
  )

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (draft.endTime <= draft.startTime) {
      setError('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onCreate({ ...draft, title: draft.title.trim(), location: draft.location.trim() })
    } catch {
      setError('สร้างรอบประชุมไม่สำเร็จ กรุณาลองอีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-5 rounded-2xl border border-blue-200 bg-blue-50/40 p-6 md:grid-cols-2">
      <div className="md:col-span-2">
        <h2 className="text-xl font-black text-slate-950">สร้างรอบประชุมใหม่</h2>
        <p className="mt-1 text-sm text-slate-600">ระบบจะสร้างกลุ่ม 1–3 จากโครงสร้างรอบล่าสุด และบันทึกเป็นแบบร่างก่อน</p>
      </div>
      <div className="md:col-span-2">{field('title', 'ชื่อรอบประชุม')}</div>
      {field('fiscalYear', 'ปีงบประมาณ', 'number')}
      {field('meetingDate', 'วันที่ประชุม', 'date')}
      {field('startTime', 'เวลาเริ่ม', 'time')}
      {field('endTime', 'เวลาสิ้นสุด', 'time')}
      <div className="md:col-span-2">{field('location', 'สถานที่')}</div>
      {error ? <p role="alert" className="text-sm font-bold text-red-700 md:col-span-2">{error}</p> : null}
      <div className="flex flex-wrap gap-3 md:col-span-2">
        <Button type="submit" disabled={saving}>{saving ? 'กำลังสร้าง...' : 'สร้างรอบประชุม'}</Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>ยกเลิก</Button>
      </div>
    </form>
  )
}
