import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type PptxGenJS from 'pptxgenjs'
import { json } from '../_lib/http.js'
import { getRequestId } from '../_lib/request.js'
import { parseServerEnv } from '../_lib/serverEnv.js'
import { createSupabaseServerClient } from '../_lib/supabaseServer.js'
import { parseExportRequest, SupabaseExportGateway, type ExportGateway, type ExportSnapshot } from '../_lib/exportSnapshot.js'

const headers = ['ประเด็น', 'ข้อค้นพบ/ปัญหา/ข้อจำกัด', 'ข้อเสนอ', 'การดำเนินงาน/แผนงาน', 'การประเมินผล/กำกับติดตาม', 'บทบาทในภาคส่วนที่เกี่ยวข้อง']
const navy = '062B6F'; const cyan = '1FA4D3'; const font = 'TH Sarabun New'
const require = createRequire(import.meta.url)
const pptxgen = require('pptxgenjs') as typeof PptxGenJS

function formatThaiMeetingDate(date: string) {
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(`${date}T12:00:00+07:00`))
}

function coverTitle(snapshot: ExportSnapshot) {
  const fiscalSuffix = new RegExp(`\\s*ปีงบประมาณ\\s*${snapshot.meeting.fiscalYear}\\s*$`)
  const title = snapshot.meeting.title.replace(fiscalSuffix, '').trim()
  return `${title}\nปีงบประมาณ ${snapshot.meeting.fiscalYear}`
}

export function buildPowerPointPlan(snapshot: ExportSnapshot) {
  return snapshot.groups.flatMap((group) => [
    { kind: 'cover' as const, group, issues: [] },
    ...(group.issues.length ? group.issues : [null]).map((issue, index) => ({ kind: 'table' as const, group, issues: issue ? [issue] : [], continuation: index > 0 })),
  ])
}

export async function buildPowerPoint(snapshot: ExportSnapshot): Promise<Buffer> {
  const pptx = new pptxgen(); pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'FA Meeting Workspace'; pptx.subject = snapshot.meeting.title
  pptx.theme = { headFontFace: font, bodyFontFace: font }
  const logo = `data:image/png;base64,${(await readFile(join(process.cwd(), 'assets', 'nhso-logo.png'))).toString('base64')}`
  for (const page of buildPowerPointPlan(snapshot)) {
    const slide = pptx.addSlide(); slide.background = { color: 'FFFFFF' }
    if (page.kind === 'cover') {
      slide.addImage({ data: logo, x: 5.45, y: 0.12, w: 2.4, h: 1.18 })
      slide.addText(coverTitle(snapshot), { x: 0.62, y: 1.55, w: 12.1, h: 1.58, fontFace: font, fontSize: 32, bold: false, color: 'FFFFFF', align: 'center', valign: 'middle', fill: { color: navy }, margin: 0.12, breakLine: false })
      slide.addText(`กลุ่ม ${page.group.groupNo} ${page.group.groupName}`, { x: 1.2, y: 3.45, w: 10.9, h: 0.9, fontFace: font, fontSize: 24, color: '087FB5', align: 'center', valign: 'middle', margin: 0.05 })
      slide.addText(`ผู้นำเสนอ ${page.group.presenter || '.............................'}`, { x: 3.7, y: 4.85, w: 5.9, h: 0.55, fontFace: font, fontSize: 22, color: navy, align: 'center' })
      slide.addText(`นำเสนอต่อคณะอนุกรรมการหลักประกันสุขภาพแห่งชาติ (อปสข.) และคณะอนุกรรมการควบคุมคุณภาพและมาตรฐานบริการสาธารณสุข (อคม.)\nวันที่ ${formatThaiMeetingDate(snapshot.meeting.meetingDate)} เวลา ${snapshot.meeting.startTime} – ${snapshot.meeting.endTime} น.\nณ ${snapshot.meeting.location}`, { x: 0.8, y: 6.05, w: 11.75, h: 1.05, fontFace: font, fontSize: 14, color: '111111', align: 'center', valign: 'middle', margin: 0.02 })
      if (page.group.status !== 'final') slide.addText('DRAFT', { x: 11.2, y: 0.25, w: 1.5, h: 0.45, fontFace: font, fontSize: 20, bold: true, color: 'B45309', rotate: -10, transparency: 10 })
    } else {
      slide.addText(`รับฟังความคิดเห็นและข้อเสนอจากกลุ่ม ${page.group.groupNo}${page.continuation ? ' (ต่อ)' : ''}`, { x: 0.18, y: 0.28, w: 8.6, h: 0.55, fontFace: font, fontSize: 25, color: '111111', margin: 0 })
      const headerRow = headers.map((text) => ({
        text,
        options: {
          fill: { color: cyan },
          fontFace: font,
          fontSize: 15,
          color: '111111',
          align: 'center' as const,
          valign: 'middle' as const,
          margin: 0.06,
        },
      }))
      const bodyRows = (page.issues.length
        ? page.issues.map((issue) => [issue.topic, issue.findings, issue.proposal, issue.actionPlan, issue.monitoring, issue.stakeholderRoles])
        : [['', '', '', '', '', '']]
      ).map((row) => row.map((text) => ({ text })))
      slide.addTable([headerRow, ...bodyRows], {
        x: 0.16,
        y: 1.34,
        w: 13.02,
        h: 5.65,
        colW: [2.14, 2.48, 2.1, 2.1, 2.1, 2.1],
        rowH: [1.55, 4.1],
        border: { type: 'solid', color: '111111', pt: 1 },
        fontFace: font,
        fontSize: 13,
        color: '111111',
        margin: 0.08,
        valign: 'top',
        breakLine: false,
        fill: { color: 'FFFFFF' },
        bold: false,
      })
      if (page.group.status !== 'final') slide.addText('DRAFT', { x: 11.6, y: 0.32, w: 1.2, h: 0.35, fontFace: font, fontSize: 17, bold: true, color: 'B45309', align: 'right', margin: 0 })
    }
  }
  const output = await pptx.write({ outputType: 'nodebuffer' })
  return Buffer.isBuffer(output) ? output : Buffer.from(output as ArrayBuffer)
}

export function createPowerPointExportHandler(gateway: ExportGateway) {
  return { async fetch(request: Request) {
    const requestId = getRequestId(request)
    if (request.method !== 'GET') return json(405, { code: 'METHOD_NOT_ALLOWED', requestId }, requestId, { allow: 'GET' })
    const token = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '')?.[1]
    if (!token) return json(401, { code: 'ADMIN_UNAUTHENTICATED', requestId }, requestId)
    try {
      const actorId = await gateway.authorize(token); if (!actorId) return json(403, { code: 'ADMIN_FORBIDDEN', requestId }, requestId)
      const input = parseExportRequest(new URL(request.url)); if (!input) return json(400, { code: 'INVALID_REQUEST', requestId }, requestId)
      const snapshot = await gateway.load(actorId, input); if (!snapshot) return json(404, { code: 'EXPORT_NOT_FOUND', requestId }, requestId)
      if (!input.draft && snapshot.groups.some((group) => group.status !== 'final')) return json(409, { code: 'DRAFT_EXPORT_REQUIRES_CONFIRMATION', requestId }, requestId)
      const buffer = await buildPowerPoint(snapshot); await gateway.audit(actorId, 'powerpoint', input, snapshot)
      return new Response(new Uint8Array(buffer), { status: 200, headers: { 'cache-control': 'no-store', 'content-type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'content-disposition': 'attachment; filename="fa-meeting-report.pptx"', 'x-request-id': requestId } })
    } catch {
      return json(503, { code: 'EXPORT_FAILED', requestId }, requestId)
    }
  } }
}

export default { async fetch(request: Request) {
  const requestId = getRequestId(request)
  try {
    const env = parseServerEnv(process.env)
    return createPowerPointExportHandler(new SupabaseExportGateway(createSupabaseServerClient(env))).fetch(request)
  } catch {
    return json(503, { code: 'EXPORT_FAILED', requestId }, requestId)
  }
} }
