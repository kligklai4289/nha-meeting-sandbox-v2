import { mockMeetingWithGroups } from './fixtures'

export const validPublicMeetingResponse = {
  data: structuredClone(mockMeetingWithGroups),
  requestId: 'test-request-id',
}
