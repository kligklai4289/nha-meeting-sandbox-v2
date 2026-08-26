import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AdminAuthError } from '../../services/auth/adminAuth'
import { FakeAdminAuth } from '../../test/fakeAdminAuth'
import { renderAppAt } from '../../test/renderApp'

const resetCompleteMessage = 'หากอีเมลนี้มีสิทธิ์ผู้ดูแล ระบบจะส่งวิธีตั้งรหัสผ่านใหม่ให้ทางอีเมล'

describe('Admin password recovery flow', () => {
  beforeEach(() => sessionStorage.clear())

  it('normalizes the email and gives the same recovery completion after a request', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth(null)
    renderAppAt('/admin/forgot-password', undefined, undefined, auth)

    await user.type(screen.getByLabelText('อีเมล'), ' ADMIN@EXAMPLE.ORG ')
    await user.click(screen.getByRole('button', { name: 'ส่งวิธีตั้งรหัสผ่านใหม่' }))

    expect(auth.requestPasswordReset).toHaveBeenCalledWith(
      'admin@example.org',
      `${window.location.origin}/admin/auth/confirm`,
    )
    expect(await screen.findByRole('status')).toHaveTextContent(resetCompleteMessage)
  })

  it('keeps the recovery submit unavailable while the request is pending', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth(null)
    let finishRequest: (() => void) | undefined
    auth.requestPasswordReset.mockImplementation(
      () => new Promise<void>((resolve) => { finishRequest = resolve }),
    )
    renderAppAt('/admin/forgot-password', undefined, undefined, auth)

    await user.type(screen.getByLabelText('อีเมล'), 'admin@example.org')
    await user.click(screen.getByRole('button', { name: 'ส่งวิธีตั้งรหัสผ่านใหม่' }))

    expect(screen.getByRole('button', { name: 'กำลังส่ง...' })).toBeDisabled()
    finishRequest?.()
    expect(await screen.findByRole('status')).toHaveTextContent(resetCompleteMessage)
  })

  it('does not disclose recovery failures or provider diagnostics', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth(null)
    auth.requestPasswordReset.mockRejectedValue(new Error('No user for recovery@example.org'))
    renderAppAt('/admin/forgot-password', undefined, undefined, auth)

    await user.type(screen.getByLabelText('อีเมล'), 'recovery@example.org')
    await user.click(screen.getByRole('button', { name: 'ส่งวิธีตั้งรหัสผ่านใหม่' }))

    expect(await screen.findByRole('status')).toHaveTextContent(resetCompleteMessage)
    expect(screen.queryByText('No user for recovery@example.org')).not.toBeInTheDocument()
  })

  it('does not consume an invite token until the owner explicitly confirms', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    renderAppAt('/admin/auth/confirm?token_hash=test-token&type=invite', undefined, undefined, auth)

    expect(auth.verifyEmailToken).not.toHaveBeenCalled()
    expect(screen.queryByText('test-token')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ยืนยันดำเนินการ' }))

    expect(auth.verifyEmailToken).toHaveBeenCalledWith('test-token', 'invite')
    expect(await screen.findByRole('heading', { name: 'ตั้งรหัสผ่านใหม่' })).toBeInTheDocument()
  })

  it('keeps the password flow ready when the verification callback observes no active profile', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth(null)
    auth.restore
      .mockResolvedValueOnce(null)
      .mockRejectedValue(new AdminAuthError('NOT_AUTHORIZED'))
    auth.verifyEmailToken.mockImplementation(async () => auth.emitAuthChange())
    const router = renderAppAt('/admin/auth/confirm?token_hash=invite-token&type=invite', undefined, undefined, auth)

    await waitFor(() => expect(auth.restore).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'ยืนยันดำเนินการ' }))

    expect(await screen.findByLabelText('รหัสผ่านใหม่')).toBeInTheDocument()
    expect(auth.signOut).not.toHaveBeenCalled()
    await router.navigate('/admin/dashboard')
    expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' })).toBeInTheDocument()
  })

  it('keeps an unavailable confirmation readiness check safe and does not expose its diagnostic', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth(null)
    auth.restore.mockResolvedValueOnce(null)
    auth.verifyEmailToken.mockImplementation(async () => auth.emitAuthChange())
    auth.restorePasswordFlow.mockRejectedValue(new AdminAuthError('UNAVAILABLE'))
    renderAppAt('/admin/auth/confirm?token_hash=unavailable-token&type=recovery', undefined, undefined, auth)

    await waitFor(() => expect(auth.restore).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'ยืนยันดำเนินการ' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ')
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(screen.queryByText('unavailable-token')).not.toBeInTheDocument()
  })

  it('confirms a recovery token only after an explicit click', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    renderAppAt('/admin/auth/confirm?token_hash=recovery-token&type=recovery', undefined, undefined, auth)

    expect(auth.verifyEmailToken).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'ยืนยันดำเนินการ' }))

    expect(auth.verifyEmailToken).toHaveBeenCalledWith('recovery-token', 'recovery')
  })

  it('rejects an unknown confirmation type without sending a token', async () => {
    const auth = new FakeAdminAuth()
    renderAppAt('/admin/auth/confirm?token_hash=test-token&type=signup', undefined, undefined, auth)

    expect(await screen.findByRole('alert')).toHaveTextContent('ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ')
    expect(auth.verifyEmailToken).not.toHaveBeenCalled()
    expect(screen.queryByText('test-token')).not.toBeInTheDocument()
  })

  it('shows a safe missing-token form error without verifying', async () => {
    const auth = new FakeAdminAuth()
    renderAppAt('/admin/auth/confirm?type=invite', undefined, undefined, auth)

    expect(await screen.findByRole('form', { name: 'ยืนยันการดำเนินการ' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ')
    expect(auth.verifyEmailToken).not.toHaveBeenCalled()
  })

  it('keeps expired-token provider diagnostics out of the confirmation error', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    auth.verifyEmailToken.mockRejectedValue(new AdminAuthError('INVALID_TOKEN'))
    renderAppAt('/admin/auth/confirm?token_hash=expired-secret&type=invite', undefined, undefined, auth)

    await user.click(screen.getByRole('button', { name: 'ยืนยันดำเนินการ' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ')
    expect(screen.queryByText('expired-secret')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin authentication failed')).not.toBeInTheDocument()
  })

  it('blocks password updates without a completed invite or recovery flow', async () => {
    const auth = new FakeAdminAuth()
    renderAppAt('/admin/update-password', undefined, undefined, auth)

    expect(await screen.findByRole('alert')).toHaveTextContent('กรุณายืนยันลิงก์จากอีเมลก่อนตั้งรหัสผ่านใหม่')
    expect(auth.updatePassword).not.toHaveBeenCalled()
  })

  it('waits for a session check before rendering the password form', () => {
    const auth = new FakeAdminAuth()
    auth.restore.mockReturnValue(new Promise(() => undefined))
    sessionStorage.setItem('admin:password-flow', 'invite')
    renderAppAt('/admin/update-password', undefined, undefined, auth)

    expect(screen.getByRole('status', { name: 'กำลังตรวจสอบสิทธิ์สำหรับการตั้งรหัสผ่าน' })).toBeInTheDocument()
    expect(screen.queryByLabelText('รหัสผ่านใหม่')).not.toBeInTheDocument()
  })

  it('rejects passwords under twelve characters and clears them', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    sessionStorage.setItem('admin:password-flow', 'invite')
    renderAppAt('/admin/update-password', undefined, undefined, auth)

    await user.type(await screen.findByLabelText('รหัสผ่านใหม่'), 'short-pass')
    await user.type(await screen.findByLabelText('ยืนยันรหัสผ่านใหม่'), 'short-pass')
    await user.click(screen.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร')
    expect(auth.updatePassword).not.toHaveBeenCalled()
    expect(screen.getByLabelText('รหัสผ่านใหม่')).toHaveValue('')
    expect(screen.getByLabelText('ยืนยันรหัสผ่านใหม่')).toHaveValue('')
  })

  it('rejects mismatched passwords and clears them', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    sessionStorage.setItem('admin:password-flow', 'recovery')
    renderAppAt('/admin/update-password', undefined, undefined, auth)

    await user.type(await screen.findByLabelText('รหัสผ่านใหม่'), 'long-enough-password')
    await user.type(await screen.findByLabelText('ยืนยันรหัสผ่านใหม่'), 'different-password')
    await user.click(screen.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('การยืนยันรหัสผ่านไม่ตรงกัน')
    expect(auth.updatePassword).not.toHaveBeenCalled()
    expect(screen.getByLabelText('รหัสผ่านใหม่')).toHaveValue('')
    expect(screen.getByLabelText('ยืนยันรหัสผ่านใหม่')).toHaveValue('')
  })

  it('keeps password submission unavailable while the update is pending', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    let finishUpdate: (() => void) | undefined
    auth.updatePassword.mockImplementation(
      () => new Promise<void>((resolve) => { finishUpdate = resolve }),
    )
    sessionStorage.setItem('admin:password-flow', 'invite')
    renderAppAt('/admin/update-password', undefined, undefined, auth)

    await user.type(await screen.findByLabelText('รหัสผ่านใหม่'), 'long-enough-password')
    await user.type(await screen.findByLabelText('ยืนยันรหัสผ่านใหม่'), 'long-enough-password')
    await user.click(screen.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่' }))

    expect(screen.getByRole('button', { name: 'กำลังบันทึกรหัสผ่าน...' })).toBeDisabled()
    finishUpdate?.()
  })

  it('clears the flow marker and takes an active administrator to the dashboard after updating', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    sessionStorage.setItem('admin:password-flow', 'invite')
    renderAppAt('/admin/update-password', undefined, undefined, auth)

    await user.type(await screen.findByLabelText('รหัสผ่านใหม่'), 'long-enough-password')
    await user.type(await screen.findByLabelText('ยืนยันรหัสผ่านใหม่'), 'long-enough-password')
    await user.click(screen.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่' }))

    expect(auth.updatePassword).toHaveBeenCalledWith('long-enough-password')
    expect(sessionStorage.getItem('admin:password-flow')).toBeNull()
    expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeInTheDocument()
  })

  it('signs out and shows a safe no-permission result when the post-update profile check fails', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    auth.restore.mockRejectedValueOnce(new AdminAuthError('NOT_AUTHORIZED'))
    sessionStorage.setItem('admin:password-flow', 'invite')
    renderAppAt('/admin/update-password', undefined, undefined, auth)

    await user.type(await screen.findByLabelText('รหัสผ่านใหม่'), 'long-enough-password')
    await user.type(await screen.findByLabelText('ยืนยันรหัสผ่านใหม่'), 'long-enough-password')
    await user.click(screen.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่' }))

    expect(await screen.findByText('ไม่สามารถดำเนินการต่อได้เนื่องจากไม่มีสิทธิ์ผู้ดูแล')).toBeInTheDocument()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('admin:password-flow')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Admin Dashboard' })).not.toBeInTheDocument()
  })

  it('does not report success or redirect when the post-update profile check is unavailable', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    auth.restore.mockRejectedValueOnce(new AdminAuthError('UNAVAILABLE'))
    sessionStorage.setItem('admin:password-flow', 'recovery')
    renderAppAt('/admin/update-password', undefined, undefined, auth)

    await user.type(await screen.findByLabelText('รหัสผ่านใหม่'), 'long-enough-password')
    await user.type(await screen.findByLabelText('ยืนยันรหัสผ่านใหม่'), 'long-enough-password')
    await user.click(screen.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่' }))

    expect(await screen.findByText('ไม่สามารถตั้งรหัสผ่านใหม่ได้ กรุณาลองใหม่อีกครั้ง')).toBeInTheDocument()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('admin:password-flow')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Admin Dashboard' })).not.toBeInTheDocument()
  })

  it('shows a safe password update failure and clears password fields', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    auth.updatePassword.mockRejectedValue(new Error('Password was rejected: private detail'))
    sessionStorage.setItem('admin:password-flow', 'recovery')
    renderAppAt('/admin/update-password', undefined, undefined, auth)

    await user.type(await screen.findByLabelText('รหัสผ่านใหม่'), 'long-enough-password')
    await user.type(await screen.findByLabelText('ยืนยันรหัสผ่านใหม่'), 'long-enough-password')
    await user.click(screen.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่สามารถตั้งรหัสผ่านใหม่ได้ กรุณาลองใหม่อีกครั้ง')
    expect(screen.queryByText('Password was rejected: private detail')).not.toBeInTheDocument()
    expect(screen.getByLabelText('รหัสผ่านใหม่')).toHaveValue('')
    expect(screen.getByLabelText('ยืนยันรหัสผ่านใหม่')).toHaveValue('')
  })

  it('clears the password-flow marker after successful logout', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    renderAppAt('/admin/dashboard', undefined, undefined, auth)

    const signOut = await screen.findByRole('button', { name: 'ออกจากระบบ' })
    sessionStorage.setItem('admin:password-flow', 'recovery')
    await user.click(signOut)

    expect(sessionStorage.getItem('admin:password-flow')).toBeNull()
  })

  it('clears the password-flow marker as soon as logout begins, even when remote logout fails', async () => {
    const user = userEvent.setup()
    const auth = new FakeAdminAuth()
    auth.signOut.mockRejectedValue(new AdminAuthError('UNAVAILABLE'))
    renderAppAt('/admin/dashboard', undefined, undefined, auth)

    const signOut = await screen.findByRole('button', { name: 'ออกจากระบบ' })
    sessionStorage.setItem('admin:password-flow', 'recovery')
    await user.click(signOut)

    expect(sessionStorage.getItem('admin:password-flow')).toBeNull()
    expect(await screen.findByRole('alert', { name: 'ไม่สามารถออกจากระบบได้' })).toBeInTheDocument()
  })
})
