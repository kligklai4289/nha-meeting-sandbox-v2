import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AdminAuthError } from '../../services/auth/adminAuth'
import { MockMeetingRepository } from '../../services/mockMeetingRepository'
import { activeAdminIdentity, FakeAdminAuth } from '../../test/fakeAdminAuth'
import { renderAppAt } from '../../test/renderApp'

describe('Admin workflow', () => {
  beforeEach(() => sessionStorage.clear())

  it('normalizes credentials and signs in an anonymous administrator', async () => {
    const user = userEvent.setup()
    const repository = new MockMeetingRepository()
    const auth = new FakeAdminAuth(null)
    renderAppAt('/admin/login', repository, undefined, auth)

    await user.type(screen.getByLabelText('อีเมล'), ' PICHAILAKARM@GMAIL.COM ')
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))

    expect(auth.signIn).toHaveBeenCalledWith(
      'pichailakarm@gmail.com',
      'correct-password',
    )
    expect(
      await screen.findByRole('heading', { name: 'Admin Dashboard' }),
    ).toBeInTheDocument()
  })

  it('keeps the login submit unavailable while authentication is in progress', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth(null)
    let finishSignIn: ((identity: typeof activeAdminIdentity) => void) | undefined
    auth.signIn.mockImplementation(
      () => new Promise((resolve) => { finishSignIn = resolve }),
    )
    renderAppAt('/admin/login', undefined, undefined, auth)

    await user.type(screen.getByLabelText('อีเมล'), 'admin@example.org')
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))

    expect(screen.getByRole('button', { name: 'กำลังเข้าสู่ระบบ...' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'กำลังเข้าสู่ระบบ...' }))
    expect(auth.signIn).toHaveBeenCalledTimes(1)

    finishSignIn?.(activeAdminIdentity)
    expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeInTheDocument()
  })

  it('shows a generic login error without provider diagnostics', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth(null)
    auth.signIn.mockRejectedValue(new AdminAuthError('INVALID_CREDENTIALS'))
    renderAppAt('/admin/login', undefined, undefined, auth)

    await user.type(screen.getByLabelText('อีเมล'), 'admin@example.org')
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบอีเมล รหัสผ่าน และสิทธิ์ผู้ดูแล',
    )
    expect(screen.queryByText('Admin authentication failed')).not.toBeInTheDocument()
    expect(screen.getByLabelText('รหัสผ่าน')).toHaveValue('')
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

  it('links real export actions to the Export Center', async () => {
    sessionStorage.setItem('admin:mock-session', 'true')
    renderAppAt('/admin/dashboard', new MockMeetingRepository())

    expect(await screen.findByRole('link', { name: 'Export Excel' })).toHaveAttribute('href', '/admin/export')
    expect(screen.getByRole('link', { name: 'Export PowerPoint' })).toHaveAttribute('href', '/admin/export')
    expect(
      screen.getByRole('link', { name: 'ดูตัวเลือก Export รายกลุ่ม' }),
    ).toHaveAttribute('href', '/admin/export')
  })
})
