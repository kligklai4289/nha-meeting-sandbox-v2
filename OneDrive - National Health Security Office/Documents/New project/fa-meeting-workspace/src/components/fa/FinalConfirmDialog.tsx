import { ConfirmDialog } from '../common/ConfirmDialog'

interface FinalConfirmDialogProps {
  groupNo: number
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function FinalConfirmDialog({ groupNo, open, onConfirm, onCancel }: FinalConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title={`ยืนยัน Final กลุ่ม ${groupNo} หรือไม่?`}
      confirmLabel={`ยืนยัน Final กลุ่ม ${groupNo}`}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      เมื่อยืนยันแล้ว FA จะไม่สามารถแก้ไขข้อมูลกลุ่มนี้ได้
    </ConfirmDialog>
  )
}
