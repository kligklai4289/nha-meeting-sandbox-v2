import { Eye, Flag, ListPlus } from 'lucide-react'
import { Button } from '../common/Button'

interface FAActionBarProps {
  onAdd: () => void
  onPreview: () => void
  onReviewReady: () => void
  onFinal: () => void
  disabled?: boolean
  reviewReady?: boolean
  finalDisabled?: boolean
}

export function FAActionBar({ onAdd, onPreview, onReviewReady, onFinal, disabled = false, reviewReady = false, finalDisabled = false }: FAActionBarProps) {
  return (
    <div className="sticky bottom-3 z-20 mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
      <Button onClick={onAdd} disabled={disabled}>
        <ListPlus aria-hidden="true" size={18} /> เพิ่มประเด็น
      </Button>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onPreview}>
          <Eye aria-hidden="true" size={18} /> ดูตัวอย่าง
        </Button>
        <Button variant="secondary" onClick={onReviewReady} disabled={disabled}>{reviewReady ? 'กลับเป็นฉบับร่าง' : 'พร้อมตรวจสอบ'}</Button>
        <Button variant="success" onClick={onFinal} disabled={disabled || finalDisabled}>
          <Flag aria-hidden="true" size={18} /> ยืนยัน Final
        </Button>
      </div>
    </div>
  )
}
