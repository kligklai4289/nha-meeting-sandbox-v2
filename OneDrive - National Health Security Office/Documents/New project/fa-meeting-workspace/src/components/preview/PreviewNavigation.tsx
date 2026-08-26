import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '../common/Button'

interface PreviewNavigationProps {
  current: number
  total: number
  onPrevious: () => void
  onNext: () => void
}

export function PreviewNavigation({ current, total, onPrevious, onNext }: PreviewNavigationProps) {
  return (
    <nav aria-label="นำทางตัวอย่างสไลด์" className="mt-5 flex items-center justify-center gap-4">
      <Button variant="secondary" onClick={onPrevious} disabled={current === 0}>
        <ArrowLeft aria-hidden="true" size={18} /> ก่อนหน้า
      </Button>
      <span className="min-w-24 text-center text-sm font-bold text-slate-700">หน้า {current + 1} / {total}</span>
      <Button variant="secondary" onClick={onNext} disabled={current === total - 1}>
        ถัดไป <ArrowRight aria-hidden="true" size={18} />
      </Button>
    </nav>
  )
}
