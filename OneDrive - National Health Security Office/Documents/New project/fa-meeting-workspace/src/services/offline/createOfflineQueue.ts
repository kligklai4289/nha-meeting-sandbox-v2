import { IndexedDbMutationStore } from './indexedDbQueue'
import {
  OfflineMutationQueue,
  type OfflineMutation,
  type OfflineMutationStore,
} from './offlineQueue'

class MemoryMutationStore implements OfflineMutationStore {
  private readonly mutations = new Map<string, OfflineMutation>()

  async put(mutation: OfflineMutation) { this.mutations.set(mutation.id, mutation) }
  async remove(id: string) { this.mutations.delete(id) }
  async list() { return [...this.mutations.values()] }
}

export function createOfflineQueue(): OfflineMutationQueue {
  const store = typeof globalThis.indexedDB === 'undefined'
    ? new MemoryMutationStore()
    : new IndexedDbMutationStore(globalThis.indexedDB)
  return new OfflineMutationQueue(store)
}
