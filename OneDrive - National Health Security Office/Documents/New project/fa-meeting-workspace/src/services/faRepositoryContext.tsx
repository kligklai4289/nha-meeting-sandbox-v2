import type { PropsWithChildren } from 'react'
import type { FaRepository } from './faRepository'
import { FaRepositoryContext } from './faRepositoryContextValue'

export function FaRepositoryProvider({
  repository,
  children,
}: PropsWithChildren<{ repository: FaRepository }>) {
  return (
    <FaRepositoryContext.Provider value={repository}>
      {children}
    </FaRepositoryContext.Provider>
  )
}
