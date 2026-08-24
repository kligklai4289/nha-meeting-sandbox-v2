import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/services/supabase/database.types'
import {
  PublicMeetingGatewayError,
  SupabasePublicMeetingGateway,
  mapPublicMeetingRows,
} from '../_lib/publicMeetingGateway.js'

type MeetingRow = Database['public']['Tables']['meetings']['Row']
type MeetingGroupRow = Database['public']['Tables']['meeting_groups']['Row']

const meetingRow: MeetingRow = {
  id: '10000000-0000-4000-8000-000000000001',
  title: 'ประชุมติดตามผลการดำเนินงาน',
  fiscal_year: 2569,
  meeting_date: '2026-08-27',
  starts_at: '09:00:00',
  ends_at: '16:30:00',
  location: 'ห้องประชุม 1',
  status: 'active',
  row_version: 1,
  created_at: '2026-08-20T08:00:00+00:00',
  updated_at: '2026-08-21T09:30:00+00:00',
}

const groupOneRow: MeetingGroupRow = {
  id: '20000000-0000-4000-8000-000000000001',
  meeting_id: meetingRow.id,
  group_no: 1,
  name: 'กลุ่มที่ 1',
  scope: 'ขอบเขตกลุ่มที่ 1',
  presenter: 'ผู้นำเสนอกลุ่มที่ 1',
  status: 'draft',
  row_version: 1,
  finalized_at: null,
  created_at: '2026-08-20T08:10:00+00:00',
  updated_at: '2026-08-21T09:40:00+00:00',
}

const groupTwoRow: MeetingGroupRow = {
  id: '20000000-0000-4000-8000-000000000002',
  meeting_id: meetingRow.id,
  group_no: 2,
  name: 'กลุ่มที่ 2',
  scope: 'ขอบเขตกลุ่มที่ 2',
  presenter: 'ผู้นำเสนอกลุ่มที่ 2',
  status: 'review_ready',
  row_version: 1,
  finalized_at: null,
  created_at: '2026-08-20T08:20:00+00:00',
  updated_at: '2026-08-21T09:50:00+00:00',
}

const meetingQueryRow = {
  id: meetingRow.id,
  title: meetingRow.title,
  fiscal_year: meetingRow.fiscal_year,
  meeting_date: meetingRow.meeting_date,
  starts_at: meetingRow.starts_at,
  ends_at: meetingRow.ends_at,
  location: meetingRow.location,
  status: meetingRow.status,
  created_at: meetingRow.created_at,
  updated_at: meetingRow.updated_at,
}

type QueryError = {
  code: string
  details: string
  hint: string
  message: string
}

type QueryResult<T> = {
  data: T
  error: QueryError | null
}

type QueryCall = {
  table: 'meetings' | 'meeting_groups'
  selectedColumns?: string
  filters: Array<{ column: string; value: unknown }>
  limit?: number
  maybeSingle?: boolean
  order?: { column: string; ascending: boolean }
}

class FakeMeetingQuery {
  private readonly call: QueryCall
  private readonly result: QueryResult<typeof meetingQueryRow | null>

  constructor(
    call: QueryCall,
    result: QueryResult<typeof meetingQueryRow | null>,
  ) {
    this.call = call
    this.result = result
  }

  select(columns: string): this {
    this.call.selectedColumns = columns
    return this
  }

  eq(column: string, value: unknown): this {
    this.call.filters.push({ column, value })
    return this
  }

  limit(count: number): this {
    this.call.limit = count
    return this
  }

  maybeSingle(): Promise<QueryResult<typeof meetingQueryRow | null>> {
    this.call.maybeSingle = true
    return Promise.resolve(this.result)
  }
}

class FakeMeetingGroupQuery {
  private readonly call: QueryCall
  private readonly result: QueryResult<MeetingGroupRow[] | null>

  constructor(
    call: QueryCall,
    result: QueryResult<MeetingGroupRow[] | null>,
  ) {
    this.call = call
    this.result = result
  }

  select(columns: string): this {
    this.call.selectedColumns = columns
    return this
  }

  eq(column: string, value: unknown): this {
    this.call.filters.push({ column, value })
    return this
  }

  order(
    column: string,
    options: { ascending: boolean },
  ): Promise<QueryResult<MeetingGroupRow[] | null>> {
    this.call.order = { column, ascending: options.ascending }
    return Promise.resolve(this.result)
  }
}

class FakePublicMeetingClient {
  readonly calls: QueryCall[] = []
  private readonly meetingResult: QueryResult<typeof meetingQueryRow | null>
  private readonly groupResult: QueryResult<MeetingGroupRow[] | null>

  constructor(
    meetingResult: QueryResult<typeof meetingQueryRow | null>,
    groupResult: QueryResult<MeetingGroupRow[] | null> = {
      data: [],
      error: null,
    },
  ) {
    this.meetingResult = meetingResult
    this.groupResult = groupResult
  }

  from(table: 'meetings' | 'meeting_groups'): unknown {
    const call: QueryCall = { table, filters: [] }
    this.calls.push(call)

    if (table === 'meetings') {
      return new FakeMeetingQuery(call, this.meetingResult)
    }

    return new FakeMeetingGroupQuery(call, this.groupResult)
  }
}

function createGateway(fakeClient: FakePublicMeetingClient) {
  return new SupabasePublicMeetingGateway(
    fakeClient as unknown as SupabaseClient<Database>,
  )
}

const queryError: QueryError = {
  code: '42501',
  details: 'private query details',
  hint: 'private query hint',
  message: 'raw Supabase permission failure',
}

describe('mapPublicMeetingRows', () => {
  it('normalizes an active meeting and sorts groups by group number', () => {
    expect(mapPublicMeetingRows(meetingRow, [groupTwoRow, groupOneRow])).toMatchObject({
      id: meetingRow.id,
      fiscalYear: '2569',
      meetingDate: '2026-08-27',
      startTime: '09:00',
      endTime: '16:30',
      isActive: true,
      groups: [
        { id: groupOneRow.id, groupNo: 1, rowVersion: 1 },
        { id: groupTwoRow.id, groupNo: 2, rowVersion: 1 },
      ],
    })
  })

  it('rejects a group number outside the public contract before return', () => {
    const invalidGroupRow: MeetingGroupRow = { ...groupOneRow, group_no: 4 }

    expect(() => mapPublicMeetingRows(meetingRow, [invalidGroupRow])).toThrowError(
      expect.objectContaining<Partial<PublicMeetingGatewayError>>({
        code: 'INVALID_DATA',
      }),
    )
  })
})

describe('SupabasePublicMeetingGateway', () => {
  it('returns null after only the exact active-meeting query when no row exists', async () => {
    const fakeClient = new FakePublicMeetingClient({ data: null, error: null })

    await expect(createGateway(fakeClient).getActiveMeeting()).resolves.toBeNull()
    expect(fakeClient.calls).toEqual([
      {
        table: 'meetings',
        selectedColumns:
          'id,title,fiscal_year,meeting_date,starts_at,ends_at,location,status,created_at,updated_at',
        filters: [{ column: 'status', value: 'active' }],
        limit: 1,
        maybeSingle: true,
      },
    ])
  })

  it('loads groups for the active meeting with exact columns and indexed ordering', async () => {
    const fakeClient = new FakePublicMeetingClient(
      { data: meetingQueryRow, error: null },
      { data: [groupTwoRow, groupOneRow], error: null },
    )

    await expect(createGateway(fakeClient).getActiveMeeting()).resolves.toMatchObject({
      id: meetingRow.id,
      groups: [{ groupNo: 1 }, { groupNo: 2 }],
    })
    expect(fakeClient.calls).toEqual([
      {
        table: 'meetings',
        selectedColumns:
          'id,title,fiscal_year,meeting_date,starts_at,ends_at,location,status,created_at,updated_at',
        filters: [{ column: 'status', value: 'active' }],
        limit: 1,
        maybeSingle: true,
      },
      {
        table: 'meeting_groups',
        selectedColumns:
          'id,meeting_id,group_no,name,scope,presenter,status,row_version,finalized_at,created_at,updated_at',
        filters: [{ column: 'meeting_id', value: meetingRow.id }],
        order: { column: 'group_no', ascending: true },
      },
    ])
  })

  it.each([
    {
      name: 'meeting query',
      meetingResult: { data: null, error: queryError },
      groupResult: { data: [], error: null },
    },
    {
      name: 'group query',
      meetingResult: { data: meetingQueryRow, error: null },
      groupResult: { data: null, error: queryError },
    },
  ])('returns a safe typed error for a failed $name', async ({
    meetingResult,
    groupResult,
  }) => {
    const fakeClient = new FakePublicMeetingClient(meetingResult, groupResult)

    const promise = createGateway(fakeClient).getActiveMeeting()
    await expect(promise).rejects.toMatchObject({
      name: 'PublicMeetingGatewayError',
      code: 'QUERY_FAILED',
      message: 'QUERY_FAILED',
    })
    await expect(promise).rejects.not.toThrow(queryError.message)
  })
})
