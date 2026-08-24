import type { OfflineMutation, OfflineMutationStore } from './offlineQueue'

const DATABASE_NAME = 'fa-meeting-workspace'
const STORE_NAME = 'offline-mutations'
const DATABASE_VERSION = 1

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('INDEXED_DB_REQUEST_FAILED'))
  })
}

export class IndexedDbMutationStore implements OfflineMutationStore {
  private databasePromise?: Promise<IDBDatabase>
  private readonly indexedDb: IDBFactory

  constructor(indexedDb: IDBFactory = indexedDB) {
    this.indexedDb = indexedDb
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise

    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.indexedDb.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('INDEXED_DB_OPEN_FAILED'))
      request.onblocked = () => reject(new Error('INDEXED_DB_BLOCKED'))
    })
    return this.databasePromise
  }

  async put(mutation: OfflineMutation): Promise<void> {
    const database = await this.open()
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    await requestResult(transaction.objectStore(STORE_NAME).put(mutation))
  }

  async remove(id: string): Promise<void> {
    const database = await this.open()
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    await requestResult(transaction.objectStore(STORE_NAME).delete(id))
  }

  async list(): Promise<OfflineMutation[]> {
    const database = await this.open()
    const transaction = database.transaction(STORE_NAME, 'readonly')
    return requestResult(transaction.objectStore(STORE_NAME).getAll()) as Promise<OfflineMutation[]>
  }
}
