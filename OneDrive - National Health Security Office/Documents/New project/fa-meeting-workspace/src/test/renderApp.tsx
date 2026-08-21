import { render } from '@testing-library/react'
import { RouterProvider } from 'react-router-dom'
import { createAppRouter } from '../app/router'
import type { MeetingRepository } from '../services/meetingRepository'
import { MockMeetingRepository } from '../services/mockMeetingRepository'
import { RepositoryProvider } from '../services/repositoryContext'

export function renderAppAt(
  path: string,
  repository: MeetingRepository = new MockMeetingRepository(),
) {
  const router = createAppRouter([path])
  render(
    <RepositoryProvider repository={repository}>
      <RouterProvider router={router} />
    </RepositoryProvider>,
  )
  return router
}
