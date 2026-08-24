import ExcelJS from 'exceljs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createMockSeed } from '../../src/services/mockSeed.js'
import { buildExcel, createExcelExportHandler } from '../exports/excel.js'

function snapshot() {
  const seed = createMockSeed()
  return { meeting: seed.meeting, groups: seed.groups.map((group) => ({ ...group, issues: seed.issues.filter((issue) => issue.groupId === group.id) })) }
}

describe('Excel export', () => {
  it('creates ordered Thai sheets with frozen filtered wrapped headers and Draft marks', async () => {
    const workbook = new ExcelJS.Workbook()
    const output = await buildExcel(snapshot())
    if (process.env.EXPORT_QA_DIR) {
      await mkdir(process.env.EXPORT_QA_DIR, { recursive: true })
      await writeFile(join(process.env.EXPORT_QA_DIR, 'fa-meeting-report.xlsx'), output)
    }
    await workbook.xlsx.load(output as unknown as ExcelJS.Buffer)

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['กลุ่ม 1', 'กลุ่ม 2', 'กลุ่ม 3'])
    const sheet = workbook.getWorksheet('กลุ่ม 1')!
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 7 })
    expect(sheet.autoFilter).toBe('A7:F7')
    expect(sheet.getRow(7).values).toEqual([undefined, 'ประเด็น', 'ข้อค้นพบ/ปัญหา/ข้อจำกัด', 'ข้อเสนอ', 'การดำเนินงาน/แผนงาน', 'การประเมินผล/กำกับติดตาม', 'บทบาทในภาคส่วนที่เกี่ยวข้อง'])
    expect(sheet.getRow(8).alignment?.wrapText).toBe(true)
    expect(sheet.getCell('A5').value).toContain('DRAFT')
  })

  it('requires an exact Bearer token and does not load export data first', async () => {
    const gateway = { authorize: vi.fn(), load: vi.fn(), audit: vi.fn() }
    const response = await createExcelExportHandler(gateway).fetch(new Request(
      'https://meeting.example/api/exports/excel?scope=all',
      { headers: { authorization: 'invalid-admin-token', 'x-request-id': 'export-request' } },
    ))

    expect(response.status).toBe(401)
    expect(gateway.authorize).not.toHaveBeenCalled()
    expect(gateway.load).not.toHaveBeenCalled()
  })

  it('loads one actor-bound snapshot and blocks an unconfirmed Draft export', async () => {
    const gateway = {
      authorize: vi.fn().mockResolvedValue('admin-id'),
      load: vi.fn().mockResolvedValue(snapshot()),
      audit: vi.fn(),
    }
    const response = await createExcelExportHandler(gateway).fetch(new Request(
      'https://meeting.example/api/exports/excel?scope=all',
      { headers: { authorization: 'Bearer valid-token', 'x-request-id': 'export-request' } },
    ))

    expect(response.status).toBe(409)
    expect(gateway.load).toHaveBeenCalledOnce()
    expect(gateway.load).toHaveBeenCalledWith('admin-id', { scope: 'all', groupId: undefined, draft: false })
    expect(gateway.audit).not.toHaveBeenCalled()
  })
})
