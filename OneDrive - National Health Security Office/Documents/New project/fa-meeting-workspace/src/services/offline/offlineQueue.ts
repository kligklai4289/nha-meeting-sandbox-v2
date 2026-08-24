import { FaRepositoryError } from '../httpFaRepository'

export type OfflineMutationKind =
  | 'issue_upsert'
  | 'issue_delete'
  | 'group_update'
  | 'group_finalize'
  | 'issues_reorder'

export interface OfflineMutation {
  id: string
  groupId: string
  targetKey: string
  kind: OfflineMutationKind
  payload: Record<string, unknown>
  createdAt: string
}

export interface OfflineMutationStore {
  put(mutation: OfflineMutation): Promise<void>
  remove(id: string): Promise<void>
  list(): Promise<OfflineMutation[]>
}

export interface OfflineFlushResult {
  completed: number
  conflicts: string[]
  pending: number
  offline: boolean
}

export class OfflineMutationQueue {
  private readonly store: OfflineMutationStore

  constructor(store: OfflineMutationStore) {
    this.store = store
  }

  enqueue(mutation: OfflineMutation): Promise<void> {
    return this.store.put(mutation)
  }

  async flush(
    process: (mutation: OfflineMutation) => Promise<void>,
    groupId?: string,
  ): Promise<OfflineFlushResult> {
    const mutations = (await this.store.list()).filter((mutation) => !groupId || mutation.groupId === groupId).sort((left, right) => {
      const byTime = left.createdAt.localeCompare(right.createdAt)
      return byTime === 0 ? left.id.localeCompare(right.id) : byTime
    })
    const blockedTargets = new Set<string>()
    let completed = 0
    let offline = false

    for (const mutation of mutations) {
      if (blockedTargets.has(mutation.targetKey)) continue

      try {
        await process(mutation)
        await this.store.remove(mutation.id)
        completed += 1
      } catch (error) {
        if (error instanceof FaRepositoryError && error.code === 'VERSION_CONFLICT') {
          blockedTargets.add(mutation.targetKey)
          continue
        }

        if (error instanceof FaRepositoryError && error.retryable) offline = true
        break
      }
    }

    return {
      completed,
      conflicts: [...blockedTargets],
      pending: (await this.store.list()).filter((mutation) => !groupId || mutation.groupId === groupId).length,
      offline,
    }
  }
}
