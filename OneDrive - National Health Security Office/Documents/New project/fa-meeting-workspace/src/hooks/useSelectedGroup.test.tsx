import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SELECTED_GROUP_KEY, useSelectedGroup } from './useSelectedGroup'

describe('useSelectedGroup', () => {
  beforeEach(() => sessionStorage.clear())

  it('stores and clears the selected group in the browser session', () => {
    const { result } = renderHook(() => useSelectedGroup())

    act(() => result.current.selectGroup('group-1'))
    expect(result.current.selectedGroupId).toBe('group-1')
    expect(sessionStorage.getItem(SELECTED_GROUP_KEY)).toBe('group-1')

    act(() => result.current.clearGroup())
    expect(result.current.selectedGroupId).toBeNull()
    expect(sessionStorage.getItem(SELECTED_GROUP_KEY)).toBeNull()
  })
})
