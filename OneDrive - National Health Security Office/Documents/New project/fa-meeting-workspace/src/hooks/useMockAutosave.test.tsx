import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockGroups, mockIssuesByGroup } from '../test/fixtures'
import { useMockAutosave } from './useMockAutosave'

describe('useMockAutosave', () => {
  afterEach(() => vi.useRealTimers())

  it('saves once after the last edit reaches the debounce delay', async () => {
    vi.useFakeTimers()
    const group = mockGroups[0]
    const issues = mockIssuesByGroup[group.id]
    const saveGroup = vi.fn().mockResolvedValue(group)
    const saveIssues = vi.fn().mockResolvedValue(issues)
    const { rerender } = renderHook((props) => useMockAutosave(props), {
      initialProps: { group, issues, delayMs: 1500, saveGroup, saveIssues },
    })

    rerender({
      group: { ...group, presenter: 'ก' },
      issues,
      delayMs: 1500,
      saveGroup,
      saveIssues,
    })
    rerender({
      group: { ...group, presenter: 'กข' },
      issues,
      delayMs: 1500,
      saveGroup,
      saveIssues,
    })

    await act(() => vi.advanceTimersByTimeAsync(1499))
    expect(saveGroup).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(saveGroup).toHaveBeenCalledTimes(1)
    expect(saveIssues).toHaveBeenCalledTimes(1)
  })
})
