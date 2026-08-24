import type { SupabaseClient } from '@supabase/supabase-js'
import type { MeetingWithGroups } from '../../src/domain/meeting.js'
import { publicMeetingSchema } from '../../src/services/publicMeetingContract.js'
import type { Database } from '../../src/services/supabase/database.types.js'

type MeetingRow = Database['public']['Tables']['meetings']['Row']
type MeetingGroupRow = Database['public']['Tables']['meeting_groups']['Row']

type PublicMeetingRow = Pick<
  MeetingRow,
  | 'id'
  | 'title'
  | 'fiscal_year'
  | 'meeting_date'
  | 'starts_at'
  | 'ends_at'
  | 'location'
  | 'status'
  | 'created_at'
  | 'updated_at'
>

type PublicMeetingGroupRow = Pick<
  MeetingGroupRow,
  | 'id'
  | 'meeting_id'
  | 'group_no'
  | 'name'
  | 'scope'
  | 'presenter'
  | 'status'
  | 'row_version'
  | 'finalized_at'
  | 'created_at'
  | 'updated_at'
>

const meetingColumns =
  'id,title,fiscal_year,meeting_date,starts_at,ends_at,location,status,created_at,updated_at'
const groupColumns =
  'id,meeting_id,group_no,name,scope,presenter,status,row_version,finalized_at,created_at,updated_at'

export type PublicMeetingGatewayErrorCode = 'QUERY_FAILED' | 'INVALID_DATA'

export class PublicMeetingGatewayError extends Error {
  readonly code: PublicMeetingGatewayErrorCode

  constructor(code: PublicMeetingGatewayErrorCode) {
    super(code)
    this.name = 'PublicMeetingGatewayError'
    this.code = code
  }
}

export interface ActiveMeetingGateway {
  getActiveMeeting(): Promise<MeetingWithGroups | null>
}

function normalizePostgresTime(value: string): string {
  return value.slice(0, 5)
}

export function mapPublicMeetingRows(
  meeting: PublicMeetingRow,
  groups: readonly PublicMeetingGroupRow[],
): MeetingWithGroups {
  const result = publicMeetingSchema.safeParse({
    id: meeting.id,
    title: meeting.title,
    fiscalYear: String(meeting.fiscal_year),
    meetingDate: meeting.meeting_date,
    startTime: normalizePostgresTime(meeting.starts_at),
    endTime: normalizePostgresTime(meeting.ends_at),
    location: meeting.location,
    isActive: meeting.status === 'active',
    createdAt: meeting.created_at,
    updatedAt: meeting.updated_at,
    groups: groups
      .map((group) => ({
        id: group.id,
        meetingId: group.meeting_id,
        groupNo: group.group_no,
        groupName: group.name,
        groupDescription: group.scope,
        presenter: group.presenter,
        status: group.status,
        rowVersion: group.row_version,
        finalizedAt: group.finalized_at,
        createdAt: group.created_at,
        updatedAt: group.updated_at,
      }))
      .sort((left, right) => left.groupNo - right.groupNo),
  })

  if (!result.success) {
    throw new PublicMeetingGatewayError('INVALID_DATA')
  }

  return result.data
}

export class SupabasePublicMeetingGateway implements ActiveMeetingGateway {
  private readonly client: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database>) {
    this.client = client
  }

  async getActiveMeeting(): Promise<MeetingWithGroups | null> {
    try {
      const { data: meeting, error: meetingError } = await this.client
        .from('meetings')
        .select(meetingColumns)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (meetingError) {
        throw new PublicMeetingGatewayError('QUERY_FAILED')
      }

      if (!meeting) return null

      const { data: groups, error: groupError } = await this.client
        .from('meeting_groups')
        .select(groupColumns)
        .eq('meeting_id', meeting.id)
        .order('group_no', { ascending: true })

      if (groupError) {
        throw new PublicMeetingGatewayError('QUERY_FAILED')
      }

      if (!groups) {
        throw new PublicMeetingGatewayError('INVALID_DATA')
      }

      return mapPublicMeetingRows(meeting, groups)
    } catch (error) {
      if (error instanceof PublicMeetingGatewayError) throw error
      throw new PublicMeetingGatewayError('QUERY_FAILED')
    }
  }
}
