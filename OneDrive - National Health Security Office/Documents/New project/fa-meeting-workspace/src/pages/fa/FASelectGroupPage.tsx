import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { EmptyState } from '../../components/common/EmptyState'
import { Loading } from '../../components/common/Loading'
import { GroupSelector } from '../../components/fa/GroupSelector'
import type { MeetingWithGroups } from '../../domain/meeting'
import { useSelectedGroup } from '../../hooks/useSelectedGroup'
import { useMeetingDirectory } from '../../services/useMeetingDirectory'
import { useFaRepository } from '../../services/useFaRepository'
import type { MeetingGroup } from '../../domain/group'

function isAbortError(reason: unknown): boolean {
  return (
    typeof reason === 'object' &&
    reason !== null &&
    'name' in reason &&
    reason.name === 'AbortError'
  )
}

export function FASelectGroupPage() {
  const directory = useMeetingDirectory()
  const faRepository = useFaRepository()
  const navigate = useNavigate()
  const { selectGroup } = useSelectedGroup()
  const [meeting, setMeeting] = useState<MeetingWithGroups | null>()
  const [error, setError] = useState<Error | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedGroup, setSelectedGroup] = useState<MeetingGroup | null>(null)
  const [accessCode, setAccessCode] = useState('')
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function openWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedGroup || !accessCode || submitting) return
    setSubmitting(true)
    setSessionError(null)
    try {
      await faRepository.createSession(selectedGroup.id, accessCode)
      setAccessCode('')
      selectGroup(selectedGroup.id)
      navigate('/fa/workspace')
    } catch {
      setSessionError('รหัสเข้ากลุ่มไม่ถูกต้อง หรือไม่สามารถเข้าสู่ระบบได้')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    directory
      .getActiveMeeting(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setMeeting(value)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || isAbortError(reason)) return
        setError(reason instanceof Error ? reason : new Error('โหลดข้อมูลไม่สำเร็จ'))
      })
    return () => {
      controller.abort()
    }
  }, [directory, reloadKey])

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <EmptyState
          title="ไม่สามารถโหลดรอบประชุมได้"
          description="โปรดลองอีกครั้ง หากยังพบปัญหาโปรดติดต่อผู้ดูแลระบบ"
          action={
            <Button
              onClick={() => {
                setError(null)
                setMeeting(undefined)
                setReloadKey((value) => value + 1)
              }}
            >
              ลองอีกครั้ง
            </Button>
          }
        />
      </main>
    )
  }

  if (meeting === undefined) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Loading label="กำลังโหลดรอบประชุมที่เปิดใช้งาน..." />
      </main>
    )
  }

  if (meeting === null) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <EmptyState
          title="ยังไม่มีรอบประชุมที่เปิดใช้งาน"
          description="กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดรอบประชุม"
        />
      </main>
    )
  }

  const meetingDate = new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(`${meeting.meetingDate}T00:00:00+07:00`))

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-4xl">
        <p className="text-sm font-bold text-blue-700">ปีงบประมาณ {meeting.fiscalYear}</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
          เลือกกลุ่มสำหรับบันทึกผลการประชุม
        </h2>
        <p className="mt-3 text-base font-semibold text-slate-700">{meeting.title}</p>
        <p className="mt-2 text-sm text-slate-500">
          {meetingDate} · {meeting.startTime}–{meeting.endTime} น. · {meeting.location}
        </p>
      </div>
      <div className="mt-8">
        <GroupSelector
          groups={meeting.groups}
          onSelect={(groupId) => {
            setSelectedGroup(meeting.groups.find((group) => group.id === groupId) ?? null)
            setAccessCode('')
            setSessionError(null)
          }}
        />
      </div>
      {selectedGroup ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-access-title"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
        >
          <form onSubmit={openWorkspace} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="group-access-title" className="text-xl font-bold text-slate-950">
              รหัสเข้ากลุ่ม {selectedGroup.groupNo}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              กรอกรหัสสำหรับ {selectedGroup.groupName} เพื่อเปิด Workspace
            </p>
            <label htmlFor="group-access-code" className="mt-5 block text-sm font-bold text-slate-800">
              รหัสเข้ากลุ่ม
            </label>
            <input
              id="group-access-code"
              type="password"
              inputMode="numeric"
              maxLength={4}
              pattern="[0-9]{4}"
              autoComplete="off"
              autoFocus
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
            {sessionError ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{sessionError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setSelectedGroup(null)
                  setAccessCode('')
                  setSessionError(null)
                }}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={!/^\d{4}$/.test(accessCode) || submitting}>
                {submitting ? 'กำลังตรวจสอบ...' : 'เข้าสู่ Workspace'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  )
}
