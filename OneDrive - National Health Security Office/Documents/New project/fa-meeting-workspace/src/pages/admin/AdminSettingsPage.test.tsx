import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MockMeetingRepository } from '../../services/mockMeetingRepository'
import { renderAppAt } from '../../test/renderApp'

const { rotate } = vi.hoisted(() => ({ rotate: vi.fn() }))
vi.mock('../../services/adminAccessCodeClient', () => ({
  adminAccessCodeService: { rotate },
}))

describe('Admin access-code settings', () => {
  beforeEach(() => {
    rotate.mockReset()
    rotate.mockResolvedValue({
      groupId: '10000000-0000-4000-8000-000000000001',
      rotatedAt: '2026-08-23T04:00:00.000Z',
      revokedSessions: 1,
    })
  })

  it('requires matching four-digit inputs and confirmation before saving', async () => {
    const user = userEvent.setup()
    renderAppAt('/admin/settings', new MockMeetingRepository())

    const saveButton = (await screen.findAllByRole('button', { name: 'บันทึกรหัสใหม่' }))[0]
    expect(saveButton).toBeDisabled()
    await user.type(screen.getByLabelText('รหัสใหม่กลุ่ม 1'), '1234')
    await user.type(screen.getByLabelText('ยืนยันรหัสกลุ่ม 1'), '1234')
    await user.click(saveButton)
    expect(screen.getByRole('heading', { name: 'บันทึกรหัสใหม่สำหรับกลุ่ม 1' })).toBeInTheDocument()
    expect(rotate).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'ยืนยันบันทึกรหัสใหม่' }))

    expect(rotate).toHaveBeenCalledWith('10000000-0000-4000-8000-000000000001', '1234')
    expect(await screen.findByText(/บันทึกรหัสใหม่สำหรับกลุ่ม 1 สำเร็จ/)).toBeInTheDocument()
  })
})
