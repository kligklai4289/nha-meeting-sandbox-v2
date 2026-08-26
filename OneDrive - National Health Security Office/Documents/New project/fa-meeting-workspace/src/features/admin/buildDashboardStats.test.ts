import { describe, expect, it } from 'vitest'
import { mockGroups, mockIssuesByGroup } from '../../test/fixtures'
import { buildDashboardStats } from './buildDashboardStats'

describe('buildDashboardStats', () => {
  it('calculates KPI values across all three groups', () => {
    expect(buildDashboardStats(mockGroups, mockIssuesByGroup)).toEqual({
      totalGroups: 3,
      totalIssues: 6,
      finalizedGroups: 1,
      latestSavedAt: '2026-08-20T03:43:00.000Z',
    })
  })
})
