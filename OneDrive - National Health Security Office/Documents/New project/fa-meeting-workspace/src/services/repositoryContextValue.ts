import { createContext } from 'react'
import type { MeetingRepository } from './meetingRepository'
import { MockMeetingRepository } from './mockMeetingRepository'

const defaultRepository = typeof window === 'undefined'
  ? new MockMeetingRepository()
  : MockMeetingRepository.fromStorage(window.localStorage)

export const RepositoryContext = createContext<MeetingRepository>(defaultRepository)
