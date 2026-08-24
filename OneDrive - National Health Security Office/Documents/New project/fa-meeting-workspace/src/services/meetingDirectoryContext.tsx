import type { PropsWithChildren } from 'react'
import type { MeetingDirectory } from './meetingDirectory'
import { MeetingDirectoryContext } from './useMeetingDirectory'

interface MeetingDirectoryProviderProps extends PropsWithChildren {
  directory: MeetingDirectory
}

export function MeetingDirectoryProvider({
  directory,
  children,
}: MeetingDirectoryProviderProps) {
  return (
    <MeetingDirectoryContext.Provider value={directory}>
      {children}
    </MeetingDirectoryContext.Provider>
  )
}
