import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { MockMeetingRepository } from '../../services/mockMeetingRepository'
import { renderAppAt } from '../../test/renderApp'

function renderAdminAt(path: string, repository = new MockMeetingRepository()) {
  sessionStorage.setItem('admin:mock-session', 'true')
  renderAppAt(path, repository)
  return repository
}

describe('Export Center and Settings', () => {
  beforeEach(() => sessionStorage.clear())

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

  it('shows deterministic feedback for a mock Excel export', async () => {
    const user = userEvent.setup()
    renderAdminAt('/admin/export')

    await user.click(await screen.findByRole('button', { name: 'Export Excel กลุ่ม 1' }))

    expect(screen.getByText('ตัวอย่าง: จะสร้างไฟล์ Excel ใน Phase Export')).toBeInTheDocument()
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

  it('confirms before resetting all trial data and refreshes the settings form', async () => {
    const user = userEvent.setup()
    const repository = renderAdminAt('/admin/settings')
    const title = await screen.findByLabelText('ชื่อรอบประชุม')
    await user.clear(title)
    await user.type(title, 'ข้อมูลทดลองที่ต้องล้าง')
    await user.click(screen.getByRole('button', { name: 'บันทึกรอบประชุม' }))

    await user.click(screen.getByRole('button', { name: 'ล้างข้อมูลทดลอง' }))
    expect(screen.getByRole('dialog', { name: 'ล้างข้อมูลทดลองทั้งหมด?' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'ยืนยันล้างข้อมูล' }))

    expect(await screen.findByLabelText('ชื่อรอบประชุม')).toHaveValue(
      'แผนการดำเนินงาน ทิศทางการทำงานร่วมกันของอนุกรรมการ ปีงบประมาณ 2570',
    )
    expect((await repository.getActiveMeeting())?.title).toBe(
      'แผนการดำเนินงาน ทิศทางการทำงานร่วมกันของอนุกรรมการ ปีงบประมาณ 2570',
    )
  })
})
