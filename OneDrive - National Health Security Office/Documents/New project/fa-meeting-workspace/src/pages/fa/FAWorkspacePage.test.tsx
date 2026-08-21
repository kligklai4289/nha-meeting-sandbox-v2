import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderWorkspaceWithSelectedGroup } from '../../test/renderWorkspace'

describe('FAWorkspacePage', () => {
  beforeEach(() => sessionStorage.clear())

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
})
