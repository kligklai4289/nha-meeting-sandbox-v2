import { createContext } from 'react'
import type { MeetingRepository } from './meetingRepository'

export const RepositoryContext = createContext<MeetingRepository | null>(null)
