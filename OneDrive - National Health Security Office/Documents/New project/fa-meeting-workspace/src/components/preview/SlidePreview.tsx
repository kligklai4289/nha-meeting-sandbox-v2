import { issueFieldLabels } from '../../content/thai'
import type { MeetingGroup } from '../../domain/group'
import type { Issue } from '../../domain/issue'
import type { Meeting } from '../../domain/meeting'
import type { PreviewSlide } from '../../features/preview/buildPreviewSlides'

interface SlidePreviewProps {
  slide: PreviewSlide
  meeting: Meeting
  group: MeetingGroup
  issue?: Issue
}

const detailFields = ['findings', 'proposal', 'actionPlan', 'monitoring', 'stakeholderRoles'] as const

export function SlidePreview({ slide, meeting, group, issue }: SlidePreviewProps) {
  if (slide.kind === 'cover') {
    return (
      <section className="aspect-video overflow-hidden rounded-2xl bg-government-navy p-[6%] text-white shadow-2xl">
        <div className="flex h-full flex-col justify-between border-l-8 border-sky-400 pl-[5%]">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-200 sm:text-sm">FA Meeting Summary</p>
          <div>
            <p className="text-sm text-blue-100 sm:text-lg">{meeting.title}</p>
            <h2 className="mt-3 text-2xl font-black sm:text-4xl lg:text-5xl">กลุ่ม {group.groupNo} {group.groupName}</h2>
            <p className="mt-4 max-w-4xl text-xs leading-5 text-blue-100 sm:text-base sm:leading-7">{group.groupDescription}</p>
          </div>
          <p className="text-xs font-semibold text-blue-200 sm:text-sm">สำนักงานหลักประกันสุขภาพแห่งชาติ</p>
        </div>
      </section>
    )
  }

  if (!issue) return null
  return (
    <section className="aspect-video overflow-auto rounded-2xl border border-slate-200 bg-white p-[4%] shadow-2xl">
      <div className="border-b-4 border-government-navy pb-3">
        <p className="text-xs font-bold text-blue-700">ประเด็นที่ {issue.sortOrder}</p>
        <h2 className="mt-1 text-lg font-black text-slate-950 sm:text-2xl">{issueFieldLabels.topic}: {issue.topic || 'ยังไม่ได้ระบุ'}</h2>
      </div>
      <div className="mt-4 grid gap-3 text-[0.6rem] sm:grid-cols-2 sm:text-xs lg:text-sm">
        {detailFields.map((field) => (
          <div key={field} className={`rounded-lg bg-slate-50 p-3 ${field === 'stakeholderRoles' ? 'sm:col-span-2' : ''}`}>
            <h3 className="font-bold text-government-navy">{issueFieldLabels[field]}</h3>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-700">{issue[field] || '—'}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
