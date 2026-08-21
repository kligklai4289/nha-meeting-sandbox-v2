import type { PropsWithChildren } from 'react'
import type { MeetingRepository } from './meetingRepository'
import { RepositoryContext } from './repositoryContextValue'

interface RepositoryProviderProps extends PropsWithChildren {
  repository: MeetingRepository
}

export function RepositoryProvider({
  repository,
  children,
}: RepositoryProviderProps) {
  return (
    <RepositoryContext.Provider value={repository}>
      {children}
    </RepositoryContext.Provider>
  )
}
