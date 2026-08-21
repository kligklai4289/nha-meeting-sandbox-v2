import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockMeetingRepository } from '../../services/mockMeetingRepository'
import { renderWorkspaceWithSelectedGroup } from '../../test/renderWorkspace'

describe('FAWorkspacePage', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.useRealTimers())

  it('shows the selected group without group-switching tabs', async () => {
    renderWorkspaceWithSelectedGroup()

    expect(
      await screen.findByText('กลุ่ม 1 บริหารกองทุน เหมาจ่าย'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'กลุ่ม 2' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'กลับไปเลือกกลุ่ม' })).toHaveAttribute(
      'href',
      '/fa',
    )
  })

  it('adds an issue and asks for confirmation before deletion', async () => {
    const user = userEvent.setup()
    renderWorkspaceWithSelectedGroup()
    const initial = await screen.findAllByRole('group', { name: /ประเด็นที่/ })

    await user.click(screen.getByRole('button', { name: 'เพิ่มประเด็น' }))
    expect(screen.getAllByRole('group', { name: /ประเด็นที่/ })).toHaveLength(
      initial.length + 1,
    )

    await user.click(screen.getAllByRole('button', { name: 'ลบประเด็น' })[0])
    expect(
      screen.getByRole('dialog', { name: 'ยืนยันการลบประเด็น' }),
    ).toBeVisible()
  })

  it('names the group in the Final confirmation and locks fields after confirmation', async () => {
    const user = userEvent.setup()
    renderWorkspaceWithSelectedGroup()

    await user.click(await screen.findByRole('button', { name: 'ยืนยัน Final' }))
    expect(screen.getByText('ยืนยัน Final กลุ่ม 1 หรือไม่?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ยืนยัน Final กลุ่ม 1' }))
    expect(screen.getByLabelText('ผู้นำเสนอ')).toBeDisabled()
    expect(screen.getAllByLabelText('ประเด็น')[0]).toBeDisabled()
    expect(screen.getByRole('button', { name: 'เพิ่มประเด็น' })).toBeDisabled()
  })

  it('does not start another autosave after updating only its own status', async () => {
    vi.useFakeTimers()
    const repository = new MockMeetingRepository()
    const saveGroup = vi.spyOn(repository, 'saveGroup')
    renderWorkspaceWithSelectedGroup(undefined, repository)

    await act(() => vi.runOnlyPendingTimersAsync())
    fireEvent.change(screen.getByLabelText('ผู้นำเสนอ'), {
      target: { value: 'ผู้แทนกลุ่ม' },
    })
    await act(() => vi.advanceTimersByTimeAsync(1500))
    await act(() => Promise.resolve())
    await act(() => vi.advanceTimersByTimeAsync(1500))

    expect(saveGroup).toHaveBeenCalledTimes(1)
  })
})
