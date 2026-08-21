import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it.each([
    ['draft', 'กำลังบันทึก'],
    ['review_ready', 'พร้อมตรวจสอบ'],
    ['final', 'Final แล้ว'],
  ] as const)('renders %s status in Thai', (status, label) => {
    render(<StatusBadge status={status} />)

    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
