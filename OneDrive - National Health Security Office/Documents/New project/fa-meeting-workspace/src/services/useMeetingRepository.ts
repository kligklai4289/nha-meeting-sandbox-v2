import { useContext } from 'react'
import type { MeetingRepository } from './meetingRepository'
import { RepositoryContext } from './repositoryContextValue'

export function useMeetingRepository(): MeetingRepository {
  const repository = useContext(RepositoryContext)
  if (!repository) throw new Error('MeetingRepositoryProvider is required')
  return repository
}
