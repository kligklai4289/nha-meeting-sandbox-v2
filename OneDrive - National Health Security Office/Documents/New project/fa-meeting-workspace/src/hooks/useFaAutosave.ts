import { useEffect, useRef, useState } from 'react'
import type { MeetingGroup } from '../domain/group'
import type { Issue } from '../domain/issue'
import type { FaRepository } from '../services/faRepository'
import { FaRepositoryError } from '../services/httpFaRepository'
import type {
  OfflineMutation,
  OfflineMutationKind,
  OfflineMutationQueue,
} from '../services/offline/offlineQueue'

export type FaAutosaveState = 'idle' | 'saving' | 'saved' | 'unsynced' | 'conflict' | 'error'

interface Options {
  group: MeetingGroup | null | undefined
  issues: Issue[]
  repository: FaRepository
  queue: OfflineMutationQueue
  delayMs: number
  onGroupSaved?: (group: MeetingGroup, submitted: MeetingGroup) => void
  onIssueSaved?: (issue: Issue, submitted: Issue) => void
}

interface Snapshot {
  group: MeetingGroup
  issues: Issue[]
}

interface WriteOperation {
  mutation: OfflineMutation
  execute: () => Promise<void>
}

function groupValue(group: MeetingGroup) {
  return JSON.stringify({ presenter: group.presenter, status: group.status })
}

function issueValue(issue: Issue) {
  return JSON.stringify({
    topic: issue.topic,
    findings: issue.findings,
    proposal: issue.proposal,
    actionPlan: issue.actionPlan,
    monitoring: issue.monitoring,
    stakeholderRoles: issue.stakeholderRoles,
  })
}

function createMutation(
  kind: OfflineMutationKind,
  groupId: string,
  targetKey: string,
  payload: Record<string, unknown>,
): OfflineMutation {
  return {
    id: crypto.randomUUID(),
    groupId,
    targetKey,
    kind,
    payload,
    createdAt: new Date().toISOString(),
  }
}

export function useFaAutosave({
  group,
  issues,
  repository,
  queue,
  delayMs,
  onGroupSaved,
  onIssueSaved,
}: Options) {
  const baseline = useRef<Snapshot | null>(null)
  const writeInFlight = useRef(false)
  const pendingWrite = useRef(false)
  const [flushRevision, setFlushRevision] = useState(0)
  const [state, setState] = useState<FaAutosaveState>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!group) return
    if (!baseline.current) {
      baseline.current = { group, issues }
      return
    }

    const previous = baseline.current
    const groupChanged = groupValue(previous.group) !== groupValue(group)
    const previousById = new Map(previous.issues.map((item) => [item.id, item]))
    const currentById = new Map(issues.map((item) => [item.id, item]))
    const deleted = previous.issues.filter((item) => !currentById.has(item.id))
    const hasNewIssue = issues.some((item) => !previousById.has(item.id))
    const reorderChanged = !hasNewIssue
      && issues.some((item) => previousById.get(item.id)?.sortOrder !== item.sortOrder)
    const changed = issues.filter((item) => {
      const old = previousById.get(item.id)
      return !old || issueValue(old) !== issueValue(item)
    })
    if (!groupChanged && deleted.length === 0 && changed.length === 0 && !reorderChanged) return
    setState('saving')

    const timer = window.setTimeout(() => {
      if (writeInFlight.current) {
        pendingWrite.current = true
        return
      }
      writeInFlight.current = true
      baseline.current = { group, issues }
      setError(null)

      const operations: WriteOperation[] = []
      if (groupChanged) {
        const mutation = createMutation('group_update', group.id, `group:${group.id}`, { group })
        operations.push({
          mutation,
          execute: async () => {
            const saved = await repository.saveGroup(group, mutation.id)
            onGroupSaved?.(saved, group)
          },
        })
      }
      for (const item of deleted) {
        const mutation = createMutation('issue_delete', group.id, `issue:${item.id}`, { issue: item })
        operations.push({ mutation, execute: () => repository.deleteIssue(item, mutation.id) })
      }
      if (reorderChanged) {
        const mutation = createMutation('issues_reorder', group.id, `group:${group.id}:order`, { issues })
        operations.push({
          mutation,
          execute: async () => {
            const savedIssues = await repository.reorderIssues(issues, mutation.id)
            for (const saved of savedIssues) {
              const submitted = issues.find((item) => item.id === saved.id)
              if (submitted) onIssueSaved?.(saved, submitted)
            }
          },
        })
      }
      for (const item of reorderChanged ? [] : changed) {
        const mutation = createMutation('issue_upsert', group.id, `issue:${item.id}`, { issue: item })
        operations.push({
          mutation,
          execute: async () => {
            const saved = await repository.upsertIssue(item, mutation.id)
            onIssueSaved?.(saved, item)
          },
        })
      }

      void (async () => {
        let offline = false
        let conflict = false
        try {
          for (const operation of operations) {
            if (offline) {
              await queue.enqueue(operation.mutation)
              continue
            }
            try {
              await operation.execute()
            } catch (reason) {
              if (reason instanceof FaRepositoryError && reason.code === 'VERSION_CONFLICT') {
                conflict = true
                continue
              }
              if (!(reason instanceof FaRepositoryError)
                || reason.retryable
                || reason.code === 'SERVICE_UNAVAILABLE') {
                offline = true
                await queue.enqueue(operation.mutation)
                continue
              }
              throw reason
            }
          }
          if (conflict) setState('conflict')
          else if (offline) setState('unsynced')
          else {
            setSavedAt(new Date().toISOString())
            setState('saved')
          }
        } catch (reason) {
          setError(reason instanceof Error ? reason : new Error('บันทึกไม่สำเร็จ'))
          setState('error')
        } finally {
          writeInFlight.current = false
          if (pendingWrite.current) {
            pendingWrite.current = false
            setFlushRevision((value) => value + 1)
          }
        }
      })()
    }, delayMs)

    return () => window.clearTimeout(timer)
  }, [delayMs, flushRevision, group, issues, onGroupSaved, onIssueSaved, queue, repository])

  return { state, savedAt, error }
}
