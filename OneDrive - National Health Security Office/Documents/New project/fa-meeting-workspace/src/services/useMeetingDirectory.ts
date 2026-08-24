import { createContext, useContext } from 'react'
import type { MeetingDirectory } from './meetingDirectory'

export const MeetingDirectoryContext = createContext<MeetingDirectory | null>(null)

export function useMeetingDirectory(): MeetingDirectory {
  const directory = useContext(MeetingDirectoryContext)
  if (!directory) throw new Error('MeetingDirectoryProvider is required')
  return directory
}
