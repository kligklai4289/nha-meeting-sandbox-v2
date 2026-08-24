import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createMockSeed } from '../../src/services/mockSeed.js'
import { buildPowerPoint, buildPowerPointPlan, createPowerPointExportHandler } from '../exports/powerpoint.js'

function snapshot() {
  const seed = createMockSeed()
  return { meeting: seed.meeting, groups: seed.groups.map((group) => ({ ...group, issues: seed.issues.filter((issue) => issue.groupId === group.id) })) }
}

describe('PowerPoint export', () => {
  it('keeps group order and creates continuation table slides instead of crowding rows', async () => {
    const plan = buildPowerPointPlan(snapshot())
    expect(plan.map((page) => `${page.group.groupNo}:${page.kind}`)).toEqual([
      '1:cover', '1:table', '1:table', '2:cover', '2:table', '2:table', '3:cover', '3:table', '3:table',
    ])
    expect(plan[2]).toMatchObject({ continuation: true })
    const buffer = await buildPowerPoint(snapshot())
    if (process.env.EXPORT_QA_DIR) {
      await mkdir(process.env.EXPORT_QA_DIR, { recursive: true })
      await writeFile(join(process.env.EXPORT_QA_DIR, 'fa-meeting-report.pptx'), buffer)
    }
    expect(buffer.subarray(0, 2).toString()).toBe('PK')
    expect(buffer.byteLength).toBeGreaterThan(50_000)
  })

  it('returns a downloadable Draft only after explicit confirmation and records the audit', async () => {
    const exportSnapshot = snapshot()
    const gateway = {
      authorize: vi.fn().mockResolvedValue('admin-id'),
      load: vi.fn().mockResolvedValue(exportSnapshot),
      audit: vi.fn().mockResolvedValue(undefined),
    }
    const response = await createPowerPointExportHandler(gateway).fetch(new Request(
      'https://meeting.example/api/exports/powerpoint?scope=group&groupId=10000000-0000-4000-8000-000000000001&draft=true',
      { headers: { authorization: 'Bearer valid-token', 'x-request-id': 'export-request' } },
    ))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(gateway.audit).toHaveBeenCalledWith(
      'admin-id',
      'powerpoint',
      { scope: 'group', groupId: '10000000-0000-4000-8000-000000000001', draft: true },
      exportSnapshot,
    )
  })

  it('hides backend failures behind a stable error response', async () => {
    const gateway = {
      authorize: vi.fn().mockRejectedValue(new Error('provider details')),
      load: vi.fn(),
      audit: vi.fn(),
    }
    const response = await createPowerPointExportHandler(gateway).fetch(new Request(
      'https://meeting.example/api/exports/powerpoint?scope=all&draft=true',
      { headers: { authorization: 'Bearer valid-token', 'x-request-id': 'export-request' } },
    ))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ code: 'EXPORT_FAILED', requestId: 'export-request' })
  })
})
