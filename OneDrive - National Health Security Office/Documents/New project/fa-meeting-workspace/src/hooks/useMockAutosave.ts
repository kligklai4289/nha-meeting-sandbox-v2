import { useEffect, useRef, useState } from 'react'
import type { MeetingGroup } from '../domain/group'
import type { Issue } from '../domain/issue'

type AutoSaveState = 'idle' | 'saving' | 'saved' | 'error'

interface UseMockAutosaveOptions {
  group: MeetingGroup | null | undefined
  issues: Issue[]
  delayMs: number
  saveGroup: (group: MeetingGroup) => Promise<MeetingGroup>
  saveIssues: (groupId: string, issues: Issue[]) => Promise<Issue[]>
}

export function useMockAutosave({
  group,
  issues,
  delayMs,
  saveGroup,
  saveIssues,
}: UseMockAutosaveOptions) {
  const loadedRef = useRef(false)
  const [state, setState] = useState<AutoSaveState>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!group) return
    if (!loadedRef.current) {
      loadedRef.current = true
      return
    }

    const timer = window.setTimeout(() => {
      setState('saving')
      setError(null)
      Promise.all([saveGroup(group), saveIssues(group.id, issues)])
        .then(() => {
          setSavedAt(new Date().toISOString())
          setState('saved')
        })
        .catch((reason: unknown) => {
          setError(reason instanceof Error ? reason : new Error('บันทึกไม่สำเร็จ'))
          setState('error')
        })
    }, delayMs)

    return () => window.clearTimeout(timer)
  }, [delayMs, group, issues, saveGroup, saveIssues])

  return { state, savedAt, error }
}
