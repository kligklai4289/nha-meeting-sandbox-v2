import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SELECTED_GROUP_KEY } from '../../hooks/useSelectedGroup'
import { renderAppAt } from '../../test/renderApp'

describe('PreviewPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem(
      SELECTED_GROUP_KEY,
      '10000000-0000-4000-8000-000000000001',
    )
  })

  it('navigates from the cover through issue slides', async () => {
    const user = userEvent.setup()
    renderAppAt('/preview')

    expect(
      await screen.findByRole('heading', {
        name: 'กลุ่ม 1 บริหารกองทุน เหมาจ่าย',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ก่อนหน้า' })).toBeDisabled()
    expect(screen.getByText('หน้า 1 / 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ถัดไป' }))
    expect(screen.getByText('ข้อค้นพบ / ปัญหา / ข้อจำกัด')).toBeInTheDocument()
    expect(screen.getByText('ข้อเสนอ')).toBeInTheDocument()
    expect(screen.getByText('การดำเนินงาน / แผนงาน')).toBeInTheDocument()
    expect(screen.getByText('การประเมินผล / กำกับติดตาม')).toBeInTheDocument()
    expect(screen.getByText('บทบาทในภาคส่วนที่เกี่ยวข้อง')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('หน้า 3 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ถัดไป' })).toBeDisabled()
  })
})
