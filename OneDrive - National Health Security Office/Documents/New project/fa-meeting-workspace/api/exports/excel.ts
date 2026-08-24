import ExcelJS from 'exceljs'
import { json } from '../_lib/http.js'
import { getRequestId } from '../_lib/request.js'
import { parseServerEnv } from '../_lib/serverEnv.js'
import { createSupabaseServerClient } from '../_lib/supabaseServer.js'
import { parseExportRequest, SupabaseExportGateway, type ExportGateway, type ExportSnapshot } from '../_lib/exportSnapshot.js'

const headers = ['ประเด็น', 'ข้อค้นพบ/ปัญหา/ข้อจำกัด', 'ข้อเสนอ', 'การดำเนินงาน/แผนงาน', 'การประเมินผล/กำกับติดตาม', 'บทบาทในภาคส่วนที่เกี่ยวข้อง']

export async function buildExcel(snapshot: ExportSnapshot): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FA Meeting Workspace'
  for (const group of snapshot.groups) {
    const sheet = workbook.addWorksheet(`กลุ่ม ${group.groupNo}`, { views: [{ state: 'frozen', ySplit: 7, showGridLines: false }] })
    sheet.mergeCells('A1:F1'); sheet.getCell('A1').value = snapshot.meeting.title
    sheet.mergeCells('A2:F2'); sheet.getCell('A2').value = `กลุ่ม ${group.groupNo} ${group.groupName}`
    sheet.mergeCells('A3:F3'); sheet.getCell('A3').value = `ผู้นำเสนอ: ${group.presenter || 'ไม่ระบุ'}`
    sheet.mergeCells('A4:F4'); sheet.getCell('A4').value = `${snapshot.meeting.meetingDate} ${snapshot.meeting.startTime}–${snapshot.meeting.endTime} | ${snapshot.meeting.location}`
    sheet.mergeCells('A5:F5'); sheet.getCell('A5').value = group.status === 'final' ? 'สถานะ: Final' : 'DRAFT — ข้อมูลยังไม่ Final'
    sheet.addRow([]); sheet.addRow(headers)
    for (const issue of group.issues) sheet.addRow([issue.topic, issue.findings, issue.proposal, issue.actionPlan, issue.monitoring, issue.stakeholderRoles])
    sheet.autoFilter = { from: 'A7', to: 'F7' }
    sheet.columns = [24, 34, 30, 34, 30, 34].map((width) => ({ width }))
    sheet.getRow(1).font = { name: 'TH Sarabun New', size: 20, bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF062B6F' } }
    sheet.getRow(2).font = { name: 'TH Sarabun New', size: 16, bold: true, color: { argb: 'FF087FB5' } }
    sheet.getRow(5).font = { name: 'TH Sarabun New', size: 12, bold: true, color: { argb: group.status === 'final' ? 'FF166534' : 'FFB45309' } }
    const header = sheet.getRow(7); header.height = 42; header.font = { name: 'TH Sarabun New', size: 14, bold: true }; header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1FA4D3' } }
    for (let row = 8; row <= sheet.rowCount; row++) { sheet.getRow(row).alignment = { vertical: 'top', wrapText: true }; sheet.getRow(row).font = { name: 'TH Sarabun New', size: 12 }; sheet.getRow(row).height = 72 }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export function createExcelExportHandler(gateway: ExportGateway) {
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
      const buffer = await buildExcel(snapshot); await gateway.audit(actorId, 'excel', input, snapshot)
      return new Response(new Uint8Array(buffer), { status: 200, headers: { 'cache-control': 'no-store', 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': 'attachment; filename="fa-meeting-report.xlsx"', 'x-request-id': requestId } })
    } catch {
      return json(503, { code: 'EXPORT_FAILED', requestId }, requestId)
    }
  } }
}

export default { async fetch(request: Request) {
  const requestId = getRequestId(request)
  try {
    const env = parseServerEnv(process.env)
    return createExcelExportHandler(new SupabaseExportGateway(createSupabaseServerClient(env))).fetch(request)
  } catch {
    return json(503, { code: 'EXPORT_FAILED', requestId }, requestId)
  }
} }
