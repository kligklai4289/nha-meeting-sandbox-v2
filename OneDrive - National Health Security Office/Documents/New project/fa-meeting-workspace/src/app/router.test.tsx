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
    renderAppAt('/fa/workspace')

    expect(
      await screen.findByRole('heading', { name: 'FA Workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Admin Dashboard' }),
    ).not.toBeInTheDocument()
  })
})
