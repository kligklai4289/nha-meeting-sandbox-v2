import { useState, type FormEvent } from 'react'
import type { Meeting } from '../../domain/meeting'
import { Button } from '../common/Button'

interface MeetingFormProps {
  meeting: Meeting
  onSave: (meeting: Meeting) => Promise<void>
}

export function MeetingForm({ meeting, onSave }: MeetingFormProps) {
  const [draft, setDraft] = useState(meeting)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const field = (key: keyof Meeting, label: string, type = 'text') => (
    <label className="text-sm font-bold text-slate-700">{label}<input aria-label={label} type={type} required min={type === 'number' ? 1 : undefined} value={String(draft[key])} onChange={(event) => { setSaved(false); setError(null); setDraft({ ...draft, [key]: event.target.value }) }} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal" /></label>
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
      await onSave({ ...draft, title: draft.title.trim(), location: draft.location.trim() })
      setSaved(true)
    } catch {
      setError('บันทึกรอบประชุมไม่สำเร็จ ข้อมูลอาจถูกแก้ไขจากหน้าต่างอื่น กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
      <div className="md:col-span-2">{field('title', 'ชื่อรอบประชุม')}</div>
      {field('fiscalYear', 'ปีงบประมาณ', 'number')}
      {field('meetingDate', 'วันที่ประชุม', 'date')}
      {field('startTime', 'เวลาเริ่ม', 'time')}
      {field('endTime', 'เวลาสิ้นสุด', 'time')}
      <div className="md:col-span-2">{field('location', 'สถานที่')}</div>
      {error ? <p role="alert" className="text-sm font-bold text-red-700 md:col-span-2">{error}</p> : null}
      <div className="flex items-center gap-3 md:col-span-2"><Button type="submit" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกรอบประชุม'}</Button>{saved && <span className="text-sm font-bold text-emerald-700">บันทึกแล้ว</span>}</div>
    </form>
  )
}
