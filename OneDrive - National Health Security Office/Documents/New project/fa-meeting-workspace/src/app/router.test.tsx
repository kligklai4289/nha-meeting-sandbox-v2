import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AdminAuthError } from '../services/auth/adminAuth'
import { renderAppAt } from '../test/renderApp'
import { FakeAdminAuth } from '../test/fakeAdminAuth'

describe('application routes', () => {
  beforeEach(() => sessionStorage.clear())

  it('redirects the root route to the FA selector', async () => {
    renderAppAt('/')

    expect(
      await screen.findByRole('heading', {
        name: 'เลือกกลุ่มสำหรับบันทึกผลการประชุม',
      }),
    ).toBeInTheDocument()
  })

  it('keeps Admin navigation out of the FA workspace', async () => {
    sessionStorage.setItem(
      'fa:selected-group-id',
      '10000000-0000-4000-8000-000000000001',
    )
    renderAppAt('/fa/workspace')

    expect(
      await screen.findByRole('heading', {
        name: 'กลุ่ม 1 บริหารกองทุน เหมาจ่าย',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Admin Dashboard' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'เข้าสู่ Admin' }),
    ).toHaveAttribute('href', '/admin/login')
  })

  it('shows an accessible loading status without the Admin Dashboard while authorization is pending', () => {
    const auth = new FakeAdminAuth()
    auth.restore.mockReturnValue(new Promise(() => undefined))
    renderAppAt('/admin/dashboard', undefined, undefined, auth)

    expect(
      screen.getByRole('status', { name: 'กำลังตรวจสอบสิทธิ์ผู้ดูแล' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Admin Dashboard' })).not.toBeInTheDocument()
  })

  it('redirects an anonymous visitor to the Admin login page', async () => {
    renderAppAt('/admin/dashboard', undefined, undefined, new FakeAdminAuth(null))

    expect(
      await screen.findByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' }),
    ).toBeInTheDocument()
  })

  it('redirects an unauthorized visitor without rendering the Admin layout', async () => {
    const auth = new FakeAdminAuth()
    auth.restore.mockRejectedValue(new AdminAuthError('NOT_AUTHORIZED'))
    renderAppAt('/admin/dashboard', undefined, undefined, auth)

    expect(
      await screen.findByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin Dashboard' })).not.toBeInTheDocument()
  })

  it('shows a safe authorization outage and retries without rendering protected content', async () => {
    const auth = new FakeAdminAuth()
    auth.restore
      .mockRejectedValueOnce(new AdminAuthError('UNAVAILABLE'))
      .mockResolvedValueOnce({
        userId: '2c866ec1-9a8c-4e54-98f6-1f9c02f7a33d',
        email: 'admin@example.org',
        displayName: 'Admin Example',
        role: 'admin',
      })
    const user = userEvent.setup()
    renderAppAt('/admin/dashboard', undefined, undefined, auth)

    expect(
      await screen.findByRole('alert', { name: 'ไม่สามารถตรวจสอบสิทธิ์ผู้ดูแลได้' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Admin Dashboard' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ลองใหม่' }))

    expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeInTheDocument()
  })

  it('does not authorize an anonymous visitor from the retired mock session key', async () => {
    sessionStorage.setItem('admin:mock-session', 'true')
    renderAppAt('/admin/dashboard', undefined, undefined, new FakeAdminAuth(null))

    expect(
      await screen.findByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Admin Dashboard' })).not.toBeInTheDocument()
  })

  it('redirects an already active administrator away from Login', async () => {
    renderAppAt('/admin/login')

    expect(
      await screen.findByRole('heading', { name: 'Admin Dashboard' }),
    ).toBeInTheDocument()
  })

  it('returns a signed-in administrator to a safe internal Admin route', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth(null)
    const router = renderAppAt('/admin/login', undefined, undefined, auth)
    await router.navigate('/admin/login', { state: { from: '/admin/settings' } })

    await user.type(screen.getByLabelText('อีเมล'), 'admin@example.org')
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))

    expect(
      await screen.findByRole('heading', { name: 'ตั้งค่ารอบประชุม' }),
    ).toBeInTheDocument()
  })

  it('rejects an external post-login route', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth(null)
    const router = renderAppAt('/admin/login', undefined, undefined, auth)
    await router.navigate('/admin/login', { state: { from: 'https://unsafe.example/admin/dashboard' } })

    await user.type(screen.getByLabelText('อีเมล'), 'admin@example.org')
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))

    expect(
      await screen.findByRole('heading', { name: 'Admin Dashboard' }),
    ).toBeInTheDocument()
  })

  it('rejects an authentication-flow post-login route', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth(null)
    const router = renderAppAt('/admin/login', undefined, undefined, auth)
    await router.navigate('/admin/login', { state: { from: '/admin/forgot-password' } })

    await user.type(screen.getByLabelText('อีเมล'), 'admin@example.org')
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))

    expect(
      await screen.findByRole('heading', { name: 'Admin Dashboard' }),
    ).toBeInTheDocument()
  })

  it('signs out from the Admin layout and removes protected content', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    const router = renderAppAt('/admin/dashboard', undefined, undefined, auth)

    expect(await screen.findByText('admin@example.org')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ออกจากระบบ' }))

    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Admin Dashboard' })).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/login')
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('disables Logout until sign out completes', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    let finishSignOut: (() => void) | undefined
    auth.signOut.mockImplementation(
      () => new Promise((resolve) => { finishSignOut = resolve }),
    )
    renderAppAt('/admin/dashboard', undefined, undefined, auth)

    const signOut = await screen.findByRole('button', { name: 'ออกจากระบบ' })
    await user.click(signOut)

    expect(signOut).toBeDisabled()
    expect(auth.signOut).toHaveBeenCalledTimes(1)

    finishSignOut?.()
    expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' })).toBeInTheDocument()
  })

  it('fails closed after a remote Logout failure and retries without exposing provider details', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    auth.signOut
      .mockImplementationOnce(async () => {
        auth.emitAuthChange()
        throw new Error('Supabase remote diagnostic')
      })
      .mockResolvedValueOnce()
    renderAppAt('/admin/dashboard', undefined, undefined, auth)

    await user.click(await screen.findByRole('button', { name: 'ออกจากระบบ' }))

    expect(
      await screen.findByRole('alert', { name: 'ไม่สามารถออกจากระบบได้' }),
    ).toHaveTextContent('ไม่สามารถออกจากระบบได้ กรุณาลองใหม่อีกครั้ง')
    expect(screen.queryByRole('heading', { name: 'Admin Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByText('Supabase remote diagnostic')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ลองออกจากระบบอีกครั้ง' }))

    expect(auth.signOut).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' })).toBeInTheDocument()
  })

  it('keeps the safe Logout failure panel available while a retry is pending', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    let finishRetry: (() => void) | undefined
    auth.signOut
      .mockRejectedValueOnce(new Error('Supabase remote diagnostic'))
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => { finishRetry = resolve }),
      )
    renderAppAt('/admin/dashboard', undefined, undefined, auth)

    await user.click(await screen.findByRole('button', { name: 'ออกจากระบบ' }))
    await screen.findByRole('alert', { name: 'ไม่สามารถออกจากระบบได้' })

    await user.click(screen.getByRole('button', { name: 'ลองออกจากระบบอีกครั้ง' }))

    expect(
      screen.getByRole('alert', { name: 'ไม่สามารถออกจากระบบได้' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Admin Dashboard' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'กำลังออกจากระบบ...' })).toBeDisabled()
    expect(auth.signOut).toHaveBeenCalledTimes(2)

    finishRetry?.()
    expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' })).toBeInTheDocument()
  })

  it('keeps the safe Logout failure panel available after a retry fails', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    auth.signOut
      .mockRejectedValueOnce(new Error('initial remote diagnostic'))
      .mockRejectedValueOnce(new Error('retry remote diagnostic'))
    renderAppAt('/admin/dashboard', undefined, undefined, auth)

    await user.click(await screen.findByRole('button', { name: 'ออกจากระบบ' }))
    await screen.findByRole('alert', { name: 'ไม่สามารถออกจากระบบได้' })

    await user.click(screen.getByRole('button', { name: 'ลองออกจากระบบอีกครั้ง' }))

    expect(
      await screen.findByRole('alert', { name: 'ไม่สามารถออกจากระบบได้' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Admin Dashboard' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ลองออกจากระบบอีกครั้ง' })).toBeEnabled()
    expect(screen.queryByText('retry remote diagnostic')).not.toBeInTheDocument()
    expect(auth.signOut).toHaveBeenCalledTimes(2)
  })

  it('lets an active administrator reach the dashboard without a mock-data banner', async () => {
    renderAppAt('/admin/dashboard')

    expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
    expect(screen.queryByText(/ข้อมูลจำลองที่เก็บในเครื่องนี้/)).not.toBeInTheDocument()
    expect(
      await screen.findByRole('link', { name: 'กลับไปหน้าบันทึกข้อมูล' }),
    ).toHaveAttribute('href', '/fa')
  })
})
