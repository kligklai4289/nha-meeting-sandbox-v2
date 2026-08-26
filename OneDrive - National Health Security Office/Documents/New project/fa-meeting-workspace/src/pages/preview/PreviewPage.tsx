import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PreviewNavigation } from '../../components/preview/PreviewNavigation'
import { SlidePreview } from '../../components/preview/SlidePreview'
import type { MeetingGroup } from '../../domain/group'
import type { Issue } from '../../domain/issue'
import type { Meeting } from '../../domain/meeting'
import { buildPreviewSlides } from '../../features/preview/buildPreviewSlides'
import { useSelectedGroup } from '../../hooks/useSelectedGroup'
import { useMeetingRepository } from '../../services/useMeetingRepository'

interface PreviewData {
  meeting: Meeting
  group: MeetingGroup
  issues: Issue[]
}

const previewMockModeBanner = (
  <div
    role="status"
    aria-label="ประกาศโหมดข้อมูลทดลองสำหรับ Preview"
    className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950"
  >
    Preview นี้สร้างจากข้อมูลจำลองที่เก็บในเครื่อง และยังไม่ใช่ข้อมูลที่บันทึกใน Supabase จริง
  </div>
)

export function PreviewPage() {
  const repository = useMeetingRepository()
  const { selectedGroupId } = useSelectedGroup()
  const [data, setData] = useState<PreviewData | null>()
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!selectedGroupId) return
    let active = true
    Promise.all([
      repository.getActiveMeeting(),
      repository.getGroup(selectedGroupId),
      repository.getIssues(selectedGroupId),
    ]).then(([meeting, group, issues]) => {
      if (!active) return
      setData(meeting && group ? { meeting, group, issues } : null)
    })
    return () => {
      active = false
    }
  }, [repository, selectedGroupId])

  const slides = useMemo(
    () => (data ? buildPreviewSlides(data.group, data.issues) : []),
    [data],
  )
  const previous = useCallback(() => setCurrent((page) => Math.max(0, page - 1)), [])
  const next = useCallback(
    () => setCurrent((page) => Math.min(slides.length - 1, page + 1)),
    [slides.length],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') previous()
      if (event.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [next, previous])

  if (!selectedGroupId || data === null) return <Navigate to="/fa" replace />
  if (!data) return <main className="mx-auto max-w-7xl px-4 py-10">กำลังโหลดตัวอย่าง...</main>

  const slide = slides[current]
  const issue = data.issues.find((candidate) => candidate.id === slide.issueId)
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {previewMockModeBanner}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-blue-700">ตัวอย่างสรุปก่อน Export</p>
          <h1 className="text-2xl font-black text-slate-950">Preview กลุ่ม {data.group.groupNo}</h1>
        </div>
        <Link to="/fa/workspace" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800">
          กลับไปแก้ไขข้อมูล
        </Link>
      </div>
      <SlidePreview slide={slide} meeting={data.meeting} group={data.group} issue={issue} />
      <PreviewNavigation current={current} total={slides.length} onPrevious={previous} onNext={next} />
      <p className="mt-4 text-center text-xs text-slate-500">ตัวอย่างนี้แสดงโครงสร้างสไลด์ ยังไม่ใช่การจัดหน้าอัตโนมัติขั้นสุดท้าย</p>
    </main>
  )
}
