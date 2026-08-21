import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { MockMeetingRepository } from '../../services/mockMeetingRepository'
import { renderAppAt } from '../../test/renderApp'

describe('Admin workflow', () => {
  beforeEach(() => sessionStorage.clear())

  it('labels mock authentication and redirects a valid mock login to Dashboard', async () => {
    const user = userEvent.setup()
    renderAppAt('/admin/login')

    expect(
      screen.getByText('โหมดตัวอย่าง — ยังไม่เชื่อม Supabase Auth'),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText('อีเมล'), 'admin@example.org')
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'demo')
    await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))

    expect(
      await screen.findByRole('heading', { name: 'Admin Dashboard' }),
    ).toBeInTheDocument()
  })

  it('shows all groups and reopens a Final group from its detail page', async () => {
    const user = userEvent.setup()
    const repository = new MockMeetingRepository()
    sessionStorage.setItem('admin:mock-session', 'true')
    renderAppAt('/admin/dashboard', repository)

    const openLinks = await screen.findAllByRole('link', { name: 'เปิดดู' })
    expect(openLinks).toHaveLength(3)
    await user.click(openLinks[1])
    expect(
      await screen.findByRole('heading', {
        name: 'กลุ่ม 2 กองทุนท้องถิ่น การจัดการส่งเสริม ป้องกัน ฟื้นฟู',
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'เปิดกลับเป็นฉบับร่าง' }))
    expect(
      await screen.findByText('กำลังบันทึก', { selector: 'span' }),
    ).toBeInTheDocument()
    expect((await repository.getGroup('10000000-0000-4000-8000-000000000002'))?.status).toBe('draft')
  })
})
