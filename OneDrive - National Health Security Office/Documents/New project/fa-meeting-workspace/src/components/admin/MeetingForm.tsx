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
  const field = (key: keyof Meeting, label: string, type = 'text') => (
    <label className="text-sm font-bold text-slate-700">{label}<input aria-label={label} type={type} value={String(draft[key])} onChange={(event) => { setSaved(false); setDraft({ ...draft, [key]: event.target.value }) }} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal" /></label>
  )
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await onSave({ ...draft, updatedAt: new Date().toISOString() })
    setSaved(true)
  }
  return (
    <form onSubmit={submit} className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
      <div className="md:col-span-2">{field('title', 'ชื่อรอบประชุม')}</div>
      {field('fiscalYear', 'ปีงบประมาณ')}
      {field('meetingDate', 'วันที่ประชุม', 'date')}
      {field('startTime', 'เวลาเริ่ม', 'time')}
      {field('endTime', 'เวลาสิ้นสุด', 'time')}
      <div className="md:col-span-2">{field('location', 'สถานที่')}</div>
      <label className="flex items-center gap-3 text-sm font-bold text-slate-700 md:col-span-2"><input type="checkbox" checked={draft.isActive} onChange={(event) => { setSaved(false); setDraft({ ...draft, isActive: event.target.checked }) }} /> เปิดใช้งานรอบประชุมนี้</label>
      <div className="flex items-center gap-3 md:col-span-2"><Button type="submit">บันทึกรอบประชุม</Button>{saved && <span className="text-sm font-bold text-emerald-700">บันทึกแล้ว</span>}</div>
    </form>
  )
}
