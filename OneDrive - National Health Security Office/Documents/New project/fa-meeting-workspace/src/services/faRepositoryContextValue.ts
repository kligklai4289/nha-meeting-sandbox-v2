import { createContext } from 'react'
import type { FaRepository } from './faRepository'

export const FaRepositoryContext = createContext<FaRepository | null>(null)
