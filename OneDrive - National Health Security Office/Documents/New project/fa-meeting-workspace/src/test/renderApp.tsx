import { render } from '@testing-library/react'
import { RouterProvider } from 'react-router-dom'
import { createAppRouter } from '../app/router'
import type { MeetingDirectory } from '../services/meetingDirectory'
import type { MeetingRepository } from '../services/meetingRepository'
import { MockMeetingRepository } from '../services/mockMeetingRepository'
import { MeetingDirectoryProvider } from '../services/meetingDirectoryContext'
import { RepositoryProvider } from '../services/repositoryContext'
import { AdminAuthProvider } from '../services/auth/adminAuthContext'
import type { AdminAuthGateway } from '../services/auth/adminAuth'
import { mockMeetingWithGroups } from './fixtures'
import { FakeAdminAuth } from './fakeAdminAuth'
import type { FaRepository } from '../services/faRepository'
import { FaRepositoryProvider } from '../services/faRepositoryContext'
import { FakeFaRepository } from './fakeFaRepository'

function createDefaultDirectory(): MeetingDirectory {
  return {
    getActiveMeeting: () => Promise.resolve(structuredClone(mockMeetingWithGroups)),
  }
}

export function renderAppAt(
  path: string,
  repository: MeetingRepository = new MockMeetingRepository(),
  directory: MeetingDirectory = createDefaultDirectory(),
  adminAuth: AdminAuthGateway = new FakeAdminAuth(),
  faRepository: FaRepository = new FakeFaRepository(),
) {
  const router = createAppRouter([path])
  render(
    <RepositoryProvider repository={repository}>
      <MeetingDirectoryProvider directory={directory}>
        <FaRepositoryProvider repository={faRepository}>
          <AdminAuthProvider gateway={adminAuth}>
            <RouterProvider router={router} />
          </AdminAuthProvider>
        </FaRepositoryProvider>
      </MeetingDirectoryProvider>
    </RepositoryProvider>,
  )
  return router
}
