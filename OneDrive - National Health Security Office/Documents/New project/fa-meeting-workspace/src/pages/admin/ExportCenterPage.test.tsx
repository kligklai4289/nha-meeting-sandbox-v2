import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MockMeetingRepository } from '../../services/mockMeetingRepository'
import { renderAppAt } from '../../test/renderApp'

const { download } = vi.hoisted(() => ({ download: vi.fn() }))
vi.mock('../../services/exportClient', () => ({ exportService: { download } }))

function renderAdminAt(path: string, repository = new MockMeetingRepository()) {
  sessionStorage.setItem('admin:mock-session', 'true')
  renderAppAt(path, repository)
  return repository
}

describe('Export Center and Settings', () => {
  beforeEach(() => { sessionStorage.clear(); download.mockReset(); download.mockResolvedValue(undefined) })

  it('shows three group cards and combined export actions', async () => {
    renderAdminAt('/admin/export')

    expect(await screen.findAllByRole('heading', { name: /กลุ่ม [123]/ })).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Export Excel รวม 3 กลุ่ม' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Export PowerPoint รวม 3 กลุ่ม' })).toBeEnabled()
  })

  it('warns before a Draft PowerPoint export', async () => {
    const user = userEvent.setup()
    renderAdminAt('/admin/export')

    await user.click(await screen.findByRole('button', { name: 'Export PowerPoint กลุ่ม 1' }))

    expect(screen.getByRole('dialog', { name: 'กลุ่มนี้ยังไม่ Final' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Export Draft' })).toBeEnabled()
  })

  it('downloads a confirmed Draft Excel export through the production service', async () => {
    const user = userEvent.setup()
    renderAdminAt('/admin/export')

    await user.click(await screen.findByRole('button', { name: 'Export Excel กลุ่ม 1' }))
    await user.click(screen.getByRole('button', { name: 'Export Draft' }))

    expect(download).toHaveBeenCalledWith('excel', 'group', '10000000-0000-4000-8000-000000000001', true)
    expect(await screen.findByText('สร้างไฟล์และเริ่มดาวน์โหลดแล้ว')).toBeInTheDocument()
  })

  it('saves meeting settings through the repository', async () => {
    const user = userEvent.setup()
    const repository = renderAdminAt('/admin/settings')
    const title = await screen.findByLabelText('ชื่อรอบประชุม')

    await user.clear(title)
    await user.type(title, 'รอบประชุมฉบับปรับปรุง')
    await user.click(screen.getByRole('button', { name: 'บันทึกรอบประชุม' }))

    expect((await repository.getActiveMeeting())?.title).toBe('รอบประชุมฉบับปรับปรุง')
  })

  it('does not expose the destructive trial-data reset in the production settings page', async () => {
    renderAdminAt('/admin/settings')

    expect(await screen.findByLabelText('ชื่อรอบประชุม')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'ล้างข้อมูลทดลอง' })).not.toBeInTheDocument()
  })
})
