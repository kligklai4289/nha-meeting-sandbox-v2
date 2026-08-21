import { SELECTED_GROUP_KEY } from '../hooks/useSelectedGroup'
import type { MeetingRepository } from '../services/meetingRepository'
import { renderAppAt } from './renderApp'

export function renderWorkspaceWithSelectedGroup(
  groupId = '10000000-0000-4000-8000-000000000001',
  repository?: MeetingRepository,
) {
  sessionStorage.setItem(SELECTED_GROUP_KEY, groupId)
  return renderAppAt('/fa/workspace', repository)
}
