import { Check, Cloud, LoaderCircle, WifiOff } from 'lucide-react'
import type { FaAutosaveState } from '../../hooks/useFaAutosave'

interface AutoSaveStatusProps {
  state: FaAutosaveState
  savedAt: string | null
}

export function AutoSaveStatus({ state, savedAt }: AutoSaveStatusProps) {
  if (state === 'saving') {
    return <><LoaderCircle aria-hidden="true" size={16} className="animate-spin" /> กำลังบันทึก...</>
  }
  if (state === 'saved' && savedAt) {
    const time = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(savedAt))
    return <><Check aria-hidden="true" size={16} /> บันทึกแล้ว {time}</>
  }
  if (state === 'unsynced') {
    return <><WifiOff aria-hidden="true" size={16} /> ยังไม่ได้ Sync</>
  }
  if (state === 'conflict') return <><WifiOff aria-hidden="true" size={16} /> พบข้อมูลชนกัน</>
  if (state === 'error') return <><WifiOff aria-hidden="true" size={16} /> บันทึกไม่สำเร็จ</>
  return <><Cloud aria-hidden="true" size={16} /> พร้อมบันทึกอัตโนมัติ</>
}
