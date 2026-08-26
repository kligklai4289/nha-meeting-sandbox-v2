import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../src/services/supabase/database.types.js'
import { SupabaseFaMutationGateway, type FaMutation } from '../_lib/faMutations.js'

const mutation: FaMutation = {
  claims: {
    sessionId: '30000000-0000-4000-8000-000000000001',
    meetingId: '00000000-0000-4000-8000-000000000001',
    groupId: '10000000-0000-4000-8000-000000000001',
    expiresAt: '2026-08-27T10:00:00.000Z',
  },
  kind: 'issue_upsert',
  mutationId: '50000000-0000-4000-8000-000000000001',
  targetId: '40000000-0000-4000-8000-000000000001',
  expectedRowVersion: 2,
  payload: { topic: 'ประเด็น' },
}

function gateway(rpc: ReturnType<typeof vi.fn>): SupabaseFaMutationGateway {
  return new SupabaseFaMutationGateway({ rpc } as unknown as SupabaseClient<Database>)
}

describe('SupabaseFaMutationGateway', () => {
  it('binds every authorization and concurrency field into one RPC call', async () => {
    const data = { ok: true, data: { id: mutation.targetId }, replayed: false }
    const rpc = vi.fn().mockResolvedValue({ data, error: null })

    await expect(gateway(rpc).apply(mutation)).resolves.toEqual(data)
    expect(rpc).toHaveBeenCalledWith('fa_apply_mutation', {
      p_session_id: mutation.claims.sessionId,
      p_meeting_id: mutation.claims.meetingId,
      p_group_id: mutation.claims.groupId,
      p_mutation_id: mutation.mutationId,
      p_kind: 'issue_upsert',
      p_target_id: mutation.targetId,
      p_expected_row_version: 2,
      p_payload: { topic: 'ประเด็น' },
    })
  })

  it('rejects malformed database results instead of treating them as successful', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { success: true }, error: null })

    await expect(gateway(rpc).apply(mutation)).rejects.toThrow('FA_MUTATION_INVALID_RESULT')
  })

  it('maps raw database errors to one safe internal error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'contains sensitive database details' },
    })

    await expect(gateway(rpc).apply(mutation)).rejects.toThrow('FA_MUTATION_QUERY_FAILED')
  })

  it('routes atomic reordering to its dedicated transaction function', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, data: { issues: [] }, replayed: false }, error: null })
    const items = [{ id: mutation.targetId, expectedRowVersion: 2, position: 0 }]

    await gateway(rpc).apply({ ...mutation, kind: 'issues_reorder', targetId: null, expectedRowVersion: 0, payload: { items } })

    expect(rpc).toHaveBeenCalledWith('fa_reorder_issues', {
      p_session_id: mutation.claims.sessionId,
      p_meeting_id: mutation.claims.meetingId,
      p_group_id: mutation.claims.groupId,
      p_mutation_id: mutation.mutationId,
      p_items: items,
    })
  })
})
