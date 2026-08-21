import { useContext } from 'react'
import type { MeetingRepository } from './meetingRepository'
import { RepositoryContext } from './repositoryContextValue'

export function useMeetingRepository(): MeetingRepository {
  return useContext(RepositoryContext)
}
