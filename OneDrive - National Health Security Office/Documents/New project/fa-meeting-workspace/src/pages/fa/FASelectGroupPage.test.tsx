import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SELECTED_GROUP_KEY } from '../../hooks/useSelectedGroup'
import { renderAppAt } from '../../test/renderApp'

describe('FASelectGroupPage', () => {
  beforeEach(() => sessionStorage.clear())

  it('shows three group cards and stores the selected group', async () => {
    const user = userEvent.setup()
    const router = renderAppAt('/fa')

    const cards = await screen.findAllByRole('button', { name: /เลือกกลุ่ม/ })
    expect(cards).toHaveLength(3)

    await user.click(cards[0])

    expect(sessionStorage.getItem(SELECTED_GROUP_KEY)).toBe(
      '10000000-0000-4000-8000-000000000001',
    )
    expect(router.state.location.pathname).toBe('/fa/workspace')
  })
})
