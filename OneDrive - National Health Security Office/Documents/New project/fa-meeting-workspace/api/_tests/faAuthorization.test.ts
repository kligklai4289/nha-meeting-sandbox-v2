import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { Database } from '../../src/services/supabase/database.types.js'
import { SupabaseFaGateway } from '../_lib/faAuthorization.js'
import { hashFaAccessCode, type FaSessionClaims } from '../_lib/faSession.js'
import type { ServerEnv } from '../_lib/serverEnv.js'

type TableName = keyof Database['public']['Tables']
type Row = Record<string, unknown>

interface QueryCall {
  table: TableName
  filters: Array<{ column: string; value: unknown }>
  nullFilters: string[]
  inserted?: Row
}

class FakeQuery {
  private readonly store: FakeSupabase
  private readonly call: QueryCall

  constructor(
    store: FakeSupabase,
    call: QueryCall,
  ) {
    this.store = store
    this.call = call
  }

  select(): this { return this }

  eq(column: string, value: unknown): this {
    this.call.filters.push({ column, value })
    return this
  }

  is(column: string, value: null): this {
    if (value === null) this.call.nullFilters.push(column)
    return this
  }

  private matchingRows(): Row[] {
    return this.store.rows[this.call.table].filter((row) =>
      this.call.filters.every((filter) => row[filter.column] === filter.value)
      && this.call.nullFilters.every((column) => row[column] === null),
    )
  }

  maybeSingle(): Promise<{ data: Row | null; error: null }> {
    return Promise.resolve({ data: this.matchingRows()[0] ?? null, error: null })
  }

  order(column: string, options: { ascending: boolean }): Promise<{ data: Row[]; error: null }> {
    const direction = options.ascending ? 1 : -1
    const data = this.matchingRows().sort((left, right) =>
      (Number(left[column]) - Number(right[column])) * direction,
    )
    return Promise.resolve({ data, error: null })
  }

  insert(row: Row): Promise<{ error: null }> {
    this.call.inserted = row
    this.store.rows[this.call.table].push(row)
    return Promise.resolve({ error: null })
  }
}

class FakeSupabase {
  readonly calls: QueryCall[] = []
  readonly rpcCalls: string[] = []
  readonly rows: Record<TableName, Row[]>
  claimAllowed = true

  constructor(seed: Partial<Record<TableName, Row[]>>) {
    this.rows = {
      admin_profiles: [], audit_logs: [], fa_access_attempts: [], fa_access_codes: [], fa_sessions: [],
      issues: [], meeting_groups: [], meetings: [], mutation_receipts: [],
      ...seed,
    }
  }

  from(table: TableName): FakeQuery {
    const call: QueryCall = { table, filters: [], nullFilters: [] }
    this.calls.push(call)
    return new FakeQuery(this, call)
  }

  rpc(name: string): Promise<{ data: unknown; error: null }> {
    this.rpcCalls.push(name)
    return Promise.resolve({
      data: name === 'fa_claim_access_attempt' ? { allowed: this.claimAllowed } : null,
      error: null,
    })
  }
}

const env: ServerEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test_gateway',
  FA_SESSION_SIGNING_SECRET: 'signing-secret-value-that-is-at-least-32-bytes',
  FA_CODE_PEPPER: 'pepper-value-that-is-at-least-32-bytes',
}

const meetingId = '00000000-0000-4000-8000-000000000001'
const groupId = '10000000-0000-4000-8000-000000000001'
const now = new Date('2026-08-27T01:00:00.000Z')

function gateway(fake: FakeSupabase): SupabaseFaGateway {
  return new SupabaseFaGateway(
    fake as unknown as SupabaseClient<Database>,
    env,
    () => now,
  )
}

describe('SupabaseFaGateway access-code exchange', () => {
  it('does not inspect a code or create a session when the meeting is closed', async () => {
    const fake = new FakeSupabase({
      meeting_groups: [{ id: groupId, meeting_id: meetingId }],
      meetings: [{ id: meetingId, status: 'closed' }],
      fa_access_codes: [{ code_hash: hashFaAccessCode('1550', env.FA_CODE_PEPPER) }],
    })

    await expect(gateway(fake).exchangeAccessCode({ groupId, accessCode: '1550', userAgent: null, clientAddress: '127.0.0.1' })).resolves.toBeNull()
    expect(fake.calls.map((call) => call.table)).toEqual(['meeting_groups', 'meetings'])
    expect(fake.rows.fa_sessions).toEqual([])
  })

  it('rejects a wrong code without creating a session', async () => {
    const fake = new FakeSupabase({
      meeting_groups: [{ id: groupId, meeting_id: meetingId }],
      meetings: [{ id: meetingId, status: 'active' }],
      fa_access_codes: [{
        meeting_id: meetingId,
        group_id: groupId,
        is_active: true,
        code_hash: hashFaAccessCode('1550', env.FA_CODE_PEPPER),
        expires_at: null,
      }],
    })

    await expect(gateway(fake).exchangeAccessCode({ groupId, accessCode: '0000', userAgent: null, clientAddress: '127.0.0.1' })).resolves.toBeNull()
    expect(fake.rows.fa_sessions).toEqual([])
    expect(fake.rpcCalls).toEqual(['fa_claim_access_attempt'])
  })

  it('stops before checking a code when the attempt limiter blocks the client', async () => {
    const fake = new FakeSupabase({
      meeting_groups: [{ id: groupId, meeting_id: meetingId }],
      meetings: [{ id: meetingId, status: 'active' }],
    })
    fake.claimAllowed = false

    await expect(gateway(fake).exchangeAccessCode({
      groupId, accessCode: '1550', userAgent: null, clientAddress: '127.0.0.1',
    })).resolves.toBeNull()

    expect(fake.calls).toEqual([])
    expect(fake.rpcCalls).toEqual(['fa_claim_access_attempt'])
    expect(fake.rows.fa_sessions).toEqual([])
  })

  it('creates a twelve-hour session bound only to the matched meeting and group', async () => {
    const fake = new FakeSupabase({
      meeting_groups: [{ id: groupId, meeting_id: meetingId }],
      meetings: [{ id: meetingId, status: 'active' }],
      fa_access_codes: [{
        meeting_id: meetingId,
        group_id: groupId,
        is_active: true,
        code_hash: hashFaAccessCode('1550', env.FA_CODE_PEPPER),
        expires_at: null,
      }],
    })

    const result = await gateway(fake).exchangeAccessCode({
      groupId,
      accessCode: '1550',
      userAgent: 'FA browser',
      clientAddress: '127.0.0.1',
    })

    expect(result).toMatchObject({
      meetingId,
      groupId,
      expiresAt: '2026-08-27T13:00:00.000Z',
    })
    expect(result?.sessionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(fake.rows.fa_sessions).toEqual([
      expect.objectContaining({
        id: result?.sessionId,
        meeting_id: meetingId,
        group_id: groupId,
        expires_at: '2026-08-27T13:00:00.000Z',
        user_agent: 'FA browser',
        session_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    ])
    expect(fake.rpcCalls).toEqual(['fa_claim_access_attempt', 'fa_clear_access_attempts'])
  })
})

describe('SupabaseFaGateway bootstrap authorization', () => {
  const claims: FaSessionClaims = {
    sessionId: '30000000-0000-4000-8000-000000000001',
    meetingId,
    groupId,
    expiresAt: '2026-08-27T13:00:00.000Z',
  }

  it('stops before loading meeting data when the stored session belongs to another group', async () => {
    const fake = new FakeSupabase({
      fa_sessions: [{
        id: claims.sessionId,
        meeting_id: meetingId,
        group_id: '10000000-0000-4000-8000-000000000002',
        expires_at: claims.expiresAt,
        revoked_at: null,
      }],
    })

    await expect(gateway(fake).getBootstrap(claims)).resolves.toBeNull()
    expect(fake.calls.map((call) => call.table)).toEqual(['fa_sessions'])
  })

  it('maps only active, non-deleted issues from the bound group', async () => {
    const fake = new FakeSupabase({
      fa_sessions: [{ id: claims.sessionId, meeting_id: meetingId, group_id: groupId, expires_at: claims.expiresAt, revoked_at: null }],
      meetings: [{ id: meetingId, title: 'การประชุม', fiscal_year: 2570, meeting_date: '2026-08-27', starts_at: '09:00:00', ends_at: '16:30:00', location: 'อยุธยา', status: 'active', created_at: now.toISOString(), updated_at: now.toISOString() }],
      meeting_groups: [{ id: groupId, meeting_id: meetingId, group_no: 1, name: 'บริหารกองทุน เหมาจ่าย', scope: 'ขอบเขต', presenter: '', status: 'draft', row_version: 2, finalized_at: null, created_at: now.toISOString(), updated_at: now.toISOString() }],
      issues: [
        { id: '40000000-0000-4000-8000-000000000002', meeting_id: meetingId, group_id: groupId, position: 1, topic: 'สอง', findings: '', proposal: '', action_plan: '', evaluation: '', stakeholder_roles: '', row_version: 1, deleted_at: null, created_at: now.toISOString(), updated_at: now.toISOString() },
        { id: '40000000-0000-4000-8000-000000000001', meeting_id: meetingId, group_id: groupId, position: 0, topic: 'หนึ่ง', findings: '', proposal: '', action_plan: '', evaluation: '', stakeholder_roles: '', row_version: 3, deleted_at: null, created_at: now.toISOString(), updated_at: now.toISOString() },
        { id: '40000000-0000-4000-8000-000000000003', meeting_id: meetingId, group_id: groupId, position: 2, topic: 'ลบแล้ว', deleted_at: now.toISOString() },
      ],
    })

    const result = await gateway(fake).getBootstrap(claims)

    expect(result?.group).toMatchObject({ id: groupId, groupNo: 1, rowVersion: 2 })
    expect(result?.issues).toEqual([
      expect.objectContaining({ topic: 'หนึ่ง', sortOrder: 1, rowVersion: 3 }),
      expect.objectContaining({ topic: 'สอง', sortOrder: 2, rowVersion: 1 }),
    ])
  })
})
