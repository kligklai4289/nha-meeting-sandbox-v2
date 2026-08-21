import { ConfirmDialog } from '../common/ConfirmDialog'

interface DraftExportDialogProps {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DraftExportDialog({ open, onCancel, onConfirm }: DraftExportDialogProps) {
  return <ConfirmDialog open={open} title="กลุ่มนี้ยังไม่ Final" confirmLabel="Export Draft" onCancel={onCancel} onConfirm={onConfirm}>ไฟล์ตัวอย่างจะมีข้อมูลตามสถานะปัจจุบันและอาจยังไม่ผ่านการตรวจสอบ</ConfirmDialog>
}
