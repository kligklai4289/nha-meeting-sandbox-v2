import { SELECTED_GROUP_KEY } from '../hooks/useSelectedGroup'
import type { MeetingDirectory } from '../services/meetingDirectory'
import type { MeetingRepository } from '../services/meetingRepository'
import { renderAppAt } from './renderApp'
import type { FaRepository } from '../services/faRepository'

export function renderWorkspaceWithSelectedGroup(
  groupId = '10000000-0000-4000-8000-000000000001',
  repository?: MeetingRepository,
  directory?: MeetingDirectory,
  faRepository?: FaRepository,
) {
  sessionStorage.setItem(SELECTED_GROUP_KEY, groupId)
  return renderAppAt('/fa/workspace', repository, directory, undefined, faRepository)
}
