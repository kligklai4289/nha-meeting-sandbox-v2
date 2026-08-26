import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MockMeetingRepository } from '../../services/mockMeetingRepository'
import { renderAppAt } from '../../test/renderApp'

async function createDraft(title: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'สร้างรอบประชุมใหม่' }))
  await user.type(screen.getByLabelText('ชื่อรอบประชุม'), title)
  await user.type(screen.getByLabelText('สถานที่'), 'ห้องประชุมทดสอบ')
  await user.click(screen.getByRole('button', { name: 'สร้างรอบประชุม' }))
  return user
}

describe('Admin meeting management', () => {
  it('creates a draft with three groups and activates it after confirmation', async () => {
    const repository = new MockMeetingRepository()
    renderAppAt('/admin/meetings', repository)

    const user = await createDraft('รอบประชุมใหม่')
    expect(await screen.findByText('สร้างรอบ “รอบประชุมใหม่” เป็นแบบร่างแล้ว')).toBeInTheDocument()

    const created = (await repository.listMeetings()).find((meeting) => meeting.title === 'รอบประชุมใหม่')
    expect(created).toMatchObject({ status: 'draft', groups: expect.arrayContaining([expect.objectContaining({ groupNo: 1 }), expect.objectContaining({ groupNo: 2 }), expect.objectContaining({ groupNo: 3 })]) })

    const card = screen.getByRole('heading', { name: 'รอบประชุมใหม่' }).closest('article')
    if (!card) throw new Error('missing meeting card')
    await user.click(within(card).getByRole('button', { name: 'เปิดใช้งาน' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'เปิดใช้งานรอบนี้' }))

    expect(await screen.findByText('เปิดใช้งานรอบ “รอบประชุมใหม่” แล้ว')).toBeInTheDocument()
    expect((await repository.getActiveMeeting())?.title).toBe('รอบประชุมใหม่')
  })

  it('deletes only the newly created draft after confirmation', async () => {
    const repository = new MockMeetingRepository()
    renderAppAt('/admin/meetings', repository)

    const user = await createDraft('รอบสำหรับลบ')
    const created = (await repository.listMeetings()).find((meeting) => meeting.title === 'รอบสำหรับลบ')
    if (!created) throw new Error('missing created meeting')
    const card = (await screen.findByRole('heading', { name: 'รอบสำหรับลบ' })).closest('article')
    if (!card) throw new Error('missing meeting card')
    await user.click(within(card).getByRole('button', { name: 'ลบแบบร่าง' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ลบรอบแบบร่าง' }))

    expect(await screen.findByText('ลบรอบ “รอบสำหรับลบ” แล้ว')).toBeInTheDocument()
    expect(await repository.getMeeting(created.id)).toBeNull()
  })
})
