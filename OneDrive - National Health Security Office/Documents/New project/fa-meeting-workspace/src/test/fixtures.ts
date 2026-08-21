import { createMockSeed } from '../services/mockSeed'

const seed = createMockSeed()

export const mockMeeting = structuredClone(seed.meeting)
export const mockGroups = structuredClone(seed.groups)
export const mockIssuesByGroup = Object.fromEntries(
  seed.groups.map((group) => [
    group.id,
    structuredClone(seed.issues.filter((issue) => issue.groupId === group.id)),
  ]),
)
