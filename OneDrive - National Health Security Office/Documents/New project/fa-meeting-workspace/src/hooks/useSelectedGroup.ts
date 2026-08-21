import { useCallback, useState } from 'react'

export const SELECTED_GROUP_KEY = 'fa:selected-group-id'

export function useSelectedGroup() {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() =>
    sessionStorage.getItem(SELECTED_GROUP_KEY),
  )

  const selectGroup = useCallback((groupId: string) => {
    sessionStorage.setItem(SELECTED_GROUP_KEY, groupId)
    setSelectedGroupId(groupId)
  }, [])

  const clearGroup = useCallback(() => {
    sessionStorage.removeItem(SELECTED_GROUP_KEY)
    setSelectedGroupId(null)
  }, [])

  return {
    selectedGroupId,
    selectGroup,
    clearGroup,
  }
}
