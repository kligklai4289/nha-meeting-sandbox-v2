import { createContext } from 'react'
import type { MeetingRepository } from './meetingRepository'
import { MockMeetingRepository } from './mockMeetingRepository'

export const RepositoryContext = createContext<MeetingRepository>(
  new MockMeetingRepository(),
)
