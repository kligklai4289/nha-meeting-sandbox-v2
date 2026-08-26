import { describe, expect, it } from 'vitest'
import { formatBangkokTime } from './dateTime'

describe('formatBangkokTime', () => {
  it('formats an ISO timestamp in Asia/Bangkok', () => {
    expect(formatBangkokTime('2026-08-20T03:42:18.000Z')).toBe('10:42:18')
  })
})
