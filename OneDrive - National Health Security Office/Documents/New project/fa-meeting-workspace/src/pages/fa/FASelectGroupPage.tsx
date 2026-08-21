import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { EmptyState } from '../../components/common/EmptyState'
import { Loading } from '../../components/common/Loading'
import { GroupSelector } from '../../components/fa/GroupSelector'
import type { MeetingWithGroups } from '../../domain/meeting'
import { useSelectedGroup } from '../../hooks/useSelectedGroup'
import { useMeetingRepository } from '../../services/useMeetingRepository'

export function FASelectGroupPage() {
  const repository = useMeetingRepository()
  const navigate = useNavigate()
  const { selectGroup } = useSelectedGroup()
  const [meeting, setMeeting] = useState<MeetingWithGroups | null>()
  const [error, setError] = useState<Error | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    repository
      .getActiveMeeting()
      .then((value) => active && setMeeting(value))
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason : new Error('โหลดข้อมูลไม่สำเร็จ'))
      })
    return () => {
      active = false
    }
  }, [repository, reloadKey])

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
            selectGroup(groupId)
            navigate('/fa/workspace')
          }}
        />
      </div>
    </main>
  )
}
