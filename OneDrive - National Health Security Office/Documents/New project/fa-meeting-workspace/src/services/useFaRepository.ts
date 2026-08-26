import { useContext } from 'react'
import { FaRepositoryContext } from './faRepositoryContextValue'

export function useFaRepository() {
  const repository = useContext(FaRepositoryContext)
  if (!repository) throw new Error('FaRepositoryProvider is required')
  return repository
}
