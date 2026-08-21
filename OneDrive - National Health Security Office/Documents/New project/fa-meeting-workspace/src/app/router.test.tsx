import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderAppAt } from '../test/renderApp'

describe('application routes', () => {
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
})
