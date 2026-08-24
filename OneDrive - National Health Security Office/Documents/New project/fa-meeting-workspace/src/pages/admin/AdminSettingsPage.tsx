import { useEffect, useState } from 'react'
import { MeetingForm } from '../../components/admin/MeetingForm'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import type { MeetingGroup } from '../../domain/group'
import type { Meeting } from '../../domain/meeting'
import { adminAccessCodeService } from '../../services/adminAccessCodeClient'
import { AdminAccessCodeError } from '../../services/adminAccessCodeService'
import type { RotatedAccessCode } from '../../services/adminAccessCodeService'
import { useMeetingRepository } from '../../services/useMeetingRepository'

export function AdminSettingsPage() {
  const repository = useMeetingRepository()
  const [meeting, setMeeting] = useState<Meeting | null>()
  const [groups, setGroups] = useState<MeetingGroup[]>([])
  const [pendingGroup, setPendingGroup] = useState<MeetingGroup | null>(null)
  const [rotating, setRotating] = useState(false)
  const [latestCode, setLatestCode] = useState<RotatedAccessCode | null>(null)
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [confirmations, setConfirmations] = useState<Record<string, string>>({})
  const [rotationError, setRotationError] = useState<string | null>(null)
  useEffect(() => {
    repository.getActiveMeeting().then((active) => {
      setMeeting(active)
      setGroups(active?.groups ?? [])
    })
  }, [repository])
  if (meeting === undefined) return <main className="p-8">กำลังโหลดการตั้งค่า...</main>
  if (meeting === null) return <main className="p-8">ไม่พบรอบประชุมที่เปิดใช้งาน</main>
  return (
    <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-sm font-bold text-blue-700">การตั้งค่าระบบ</p>
      <h1 className="mb-6 mt-1 text-3xl font-black text-slate-950">ตั้งค่ารอบประชุม</h1>
      <MeetingForm
        key={meeting.updatedAt}
        meeting={meeting}
        onSave={async (next) => { setMeeting(await repository.saveMeeting(next)) }}
      />
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-slate-950">รหัสเข้าใช้งานสำหรับ FA</h2>
        <p className="mt-1 text-sm text-slate-600">กำหนดตัวเลข 4 หลัก รหัสต้องไม่ซ้ำกัน การเปลี่ยนรหัสจะยกเลิกรหัสเดิมและ Session ของกลุ่มนั้นทันที</p>
        {rotationError ? <p role="alert" className="mt-3 text-sm font-bold text-red-700">{rotationError}</p> : null}
        <div className="mt-4 grid gap-3">
          {groups.map((group) => (
            <div key={group.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
              <div>
                <p className="font-black text-slate-950">กลุ่ม {group.groupNo}</p>
                <p className="text-sm text-slate-600">{group.groupName}</p>
              </div>
              <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[9rem_9rem_auto]">
                <input aria-label={`รหัสใหม่กลุ่ม ${group.groupNo}`} type="password" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="รหัสใหม่ 4 หลัก" value={codes[group.id] ?? ''} onChange={(event) => setCodes((current) => ({ ...current, [group.id]: event.target.value.replace(/\D/g, '').slice(0, 4) }))} className="min-h-11 rounded-xl border border-slate-300 px-3" />
                <input aria-label={`ยืนยันรหัสกลุ่ม ${group.groupNo}`} type="password" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="ยืนยันรหัส" value={confirmations[group.id] ?? ''} onChange={(event) => setConfirmations((current) => ({ ...current, [group.id]: event.target.value.replace(/\D/g, '').slice(0, 4) }))} className="min-h-11 rounded-xl border border-slate-300 px-3" />
                <button type="button" className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60" disabled={rotating || !/^\d{4}$/.test(codes[group.id] ?? '') || codes[group.id] !== confirmations[group.id]} onClick={() => setPendingGroup(group)}>
                  บันทึกรหัสใหม่
                </button>
              </div>
            </div>
          ))}
        </div>
        {latestCode ? (
          <div role="status" className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
            <p className="text-sm font-bold">บันทึกรหัสใหม่สำหรับกลุ่ม {groups.find((group) => group.id === latestCode.groupId)?.groupNo} สำเร็จ</p>
            <p className="mt-1 text-xs">ระบบเก็บเฉพาะค่า Hash และไม่สามารถแสดงรหัสเดิมย้อนหลังได้</p>
          </div>
        ) : null}
      </section>
      <ConfirmDialog
        open={Boolean(pendingGroup)}
        title={`บันทึกรหัสใหม่สำหรับกลุ่ม ${pendingGroup?.groupNo ?? ''}`}
        confirmLabel={rotating ? 'กำลังบันทึก...' : 'ยืนยันบันทึกรหัสใหม่'}
        destructive
        onCancel={() => setPendingGroup(null)}
        onConfirm={() => {
          if (!pendingGroup || rotating) return
          setRotating(true)
          setRotationError(null)
          void adminAccessCodeService.rotate(pendingGroup.id, codes[pendingGroup.id] ?? '')
            .then((result) => {
              setLatestCode(result)
              setCodes((current) => ({ ...current, [pendingGroup.id]: '' }))
              setConfirmations((current) => ({ ...current, [pendingGroup.id]: '' }))
            })
            .catch((error: unknown) => setRotationError(error instanceof AdminAccessCodeError && error.code === 'DUPLICATE_ACCESS_CODE' ? 'รหัสนี้ถูกใช้กับกลุ่มอื่นแล้ว กรุณากำหนดรหัสใหม่' : 'บันทึกรหัสใหม่ไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง'))
            .finally(() => { setRotating(false); setPendingGroup(null) })
        }}
      >
        รหัสเดิมและ Session FA ของกลุ่มนี้จะใช้ต่อไม่ได้ ต้องการบันทึกรหัส 4 หลักใหม่นี้หรือไม่
      </ConfirmDialog>
    </main>
  )
}
